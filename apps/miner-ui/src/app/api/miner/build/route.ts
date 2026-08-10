import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// In-memory lock to prevent concurrent build processes
let isBuilding = false;
let lastBuildStartTime = 0;

// Helper to kill active miner processes holding file locks
async function terminateRunningMiners(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
    controller.enqueue(encoder.encode('> Checking for active quai-gpu-miner process locks...\n'));
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /F /T /IM quai-gpu-miner.exe 2>nul', { stdio: 'ignore' });
            execSync('taskkill /F /T /IM quai-cpu-miner.exe 2>nul', { stdio: 'ignore' });
        } else {
            execSync('pkill -9 -f quai-gpu-miner 2>/dev/null', { stdio: 'ignore' });
            execSync('pkill -9 -f quai-cpu-miner 2>/dev/null', { stdio: 'ignore' });
        }
        controller.enqueue(encoder.encode('> Terminated active miner instances to release binary locks.\n'));
    } catch (e) {
        controller.enqueue(encoder.encode('> No active miner processes found holding locks.\n'));
    }

    // Give OS kernel 500ms to clean up handles & release file locks
    await new Promise((resolve) => setTimeout(resolve, 500));
}

// Helper to safely clean up old binary files before build
function cleanStaleBinaries(cwdPath: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
    const candidateBinaries = [
        path.join(cwdPath, 'build-vs', 'kawpowminer', 'Release', 'quai-gpu-miner.exe'),
        path.join(cwdPath, 'build-ninja', 'kawpowminer', 'quai-gpu-miner.exe'),
        path.join(cwdPath, 'build', 'kawpowminer', 'quai-gpu-miner.exe')
    ];

    for (const binPath of candidateBinaries) {
        if (fs.existsSync(binPath)) {
            try {
                fs.unlinkSync(binPath);
                controller.enqueue(encoder.encode(`> Successfully unlinked target binary: ${path.basename(binPath)}\n`));
            } catch (err: any) {
                controller.enqueue(encoder.encode(`> [WARNING] Unable to unlink ${path.basename(binPath)}: ${err.message}\n`));
            }
        }
    }
}

export async function POST() {
    // Safety auto-unlock if lock is older than 5 minutes
    if (isBuilding && Date.now() - lastBuildStartTime > 300000) {
        isBuilding = false;
    }

    if (isBuilding) {
        return new Response("A build is already in progress. Please wait for it to complete.", { status: 409 });
    }

    isBuilding = true;
    lastBuildStartTime = Date.now();

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                controller.enqueue(encoder.encode("Initializing Quai miner build sequence...\n"));
                
                const cwdPath = path.join(process.cwd(), '..', 'quai-gpu-miner');

                // Step 1: Kill active process handles
                await terminateRunningMiners(controller, encoder);

                // Step 2: Unlink old binaries to guarantee writable target
                cleanStaleBinaries(cwdPath, controller, encoder);
                
                // Step 3: Purge corrupted Hunter Boost build caches caused by previous MinGW attempts
                const hunterBoostBuildDir = 'C:\\.hunter\\_Base\\e70c29f\\2520931\\692f63a\\Build\\Boost';
                if (fs.existsSync(hunterBoostBuildDir)) {
                    try {
                        controller.enqueue(encoder.encode(`> Purging corrupted Hunter Boost build cache in ${hunterBoostBuildDir}...\n`));
                        fs.rmSync(hunterBoostBuildDir, { recursive: true, force: true });
                    } catch (e) {}
                }

                // Sanitize PATH environment variable to completely strip Strawberry/MinGW GCC binaries
                const cleanPath = (process.env.PATH || '')
                    .split(';')
                    .filter(p => !/strawberry|mingw|gcc/i.test(p))
                    .join(';');

                const cmakePath = 'C:\\Program Files\\CMake\\bin';
                const env = { 
                    ...process.env, 
                    HUNTER_ROOT: 'C:\\.hunter',
                    PATH: `${cmakePath};${cleanPath}`
                };

                const runBuild = (generator: string, buildDir: string, extraArgs: string[] = [], buildArgs: string[] = []): Promise<number> => {
                    return new Promise((resolve) => {
                        const fullBuildPath = path.join(cwdPath, buildDir);
                        const cacheFile = path.join(fullBuildPath, 'CMakeCache.txt');
                        if (fs.existsSync(cacheFile)) {
                            try {
                                controller.enqueue(encoder.encode(`> Removing stale CMakeCache.txt in ./${buildDir}...\n`));
                                fs.rmSync(cacheFile, { force: true });
                            } catch (e) {
                                // Ignore lock errors
                            }
                        }

                        controller.enqueue(encoder.encode(`> Attempting build with ${generator} in ./${buildDir}...\n`));
                        
                        const configCmd = spawn(path.join(cmakePath, 'cmake.exe'), 
                            ['.', '-B', buildDir, '--fresh', '-G', generator, ...extraArgs, '-DHUNTER_STATUS_DEBUG=ON', '-DCMAKE_POLICY_VERSION_MINIMUM=3.5'], 
                            { cwd: cwdPath, env }
                        );

                        configCmd.stdout.on('data', d => controller.enqueue(encoder.encode(d.toString())));
                        configCmd.stderr.on('data', d => controller.enqueue(encoder.encode(d.toString())));
                        
                        configCmd.on('close', (code) => {
                            if (code !== 0) {
                                resolve(code);
                                return;
                            }
                            
                            controller.enqueue(encoder.encode(`> ${generator} configure successful. Starting compilation...\n`));
                            const buildCmd = spawn(path.join(cmakePath, 'cmake.exe'), 
                                ['--build', buildDir, '--config', 'Release', ...buildArgs], 
                                { cwd: cwdPath, env }
                            );
                            
                            buildCmd.stdout.on('data', d => controller.enqueue(encoder.encode(d.toString())));
                            buildCmd.stderr.on('data', d => controller.enqueue(encoder.encode(d.toString())));
                            
                            buildCmd.on('close', (bcode) => resolve(bcode));
                        });
                    });
                };

                // Attempt 1: Visual Studio 17 2022 (Native MSVC toolchain for Windows)
                let result = await runBuild('Visual Studio 17 2022', 'build-vs', ['-A', 'x64'], ['--', '/m']);

                // Fallback: Ninja generator
                if (result !== 0) {
                    controller.enqueue(encoder.encode("\n[INFO] Visual Studio build failed or unavailable. Falling back to Ninja...\n"));
                    result = await runBuild('Ninja', 'build-ninja');
                }

                if (result === 0) {
                    controller.enqueue(encoder.encode("\n[SUCCESS] Build completed successfully. Binary is ready.\n"));
                } else {
                    controller.enqueue(encoder.encode(`\n[FAILED] Build process failed after all attempts. Final exit code: ${result}\n`));
                }
            } catch (err: any) {
                controller.enqueue(encoder.encode(`\n[FATAL ERROR] Build process encountered exception: ${err?.message || err}\n`));
            } finally {
                isBuilding = false;
                controller.close();
            }
        }
    });

    return new Response(stream);
}
