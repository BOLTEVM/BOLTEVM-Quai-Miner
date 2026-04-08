import { spawn } from 'child_process';
import path from 'path';

// Simple in-memory lock to prevent concurrent build processes
let isBuilding = false;

export async function POST() {
    if (isBuilding) {
        return new Response("A build is already in progress. Please wait for it to complete.", { status: 409 });
    }

    isBuilding = true;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode("Initializing Quai miner build sequence...\n"));
            
            const cwdPath = path.join(process.cwd(), '..', 'quai-gpu-miner');
            
            // Set up Strawberry Perl and Ninja environment
            const strawberryPerlPath = 'C:\\Strawberry\\perl\\bin';
            const strawberryCPath = 'C:\\Strawberry\\c\\bin';
            const cmakePath = 'C:\\Program Files\\CMake\\bin';
            
            const env = { 
                ...process.env, 
                HUNTER_ROOT: 'C:\\h',
                PATH: `${strawberryPerlPath};${strawberryCPath};${cmakePath};${process.env.PATH}`
            };

            const runBuild = (generator: string, buildDir: string, extraArgs: string[] = [], buildArgs: string[] = []): Promise<number> => {
                return new Promise((resolve) => {
                    controller.enqueue(encoder.encode(`> Attempting build with ${generator} in ./${buildDir}...\n`));
                    
                    const configCmd = spawn(path.join(cmakePath, 'cmake.exe'), 
                        ['.', '-B', buildDir, '-G', generator, ...extraArgs, '-DHUNTER_STATUS_DEBUG=ON', '-DCMAKE_POLICY_VERSION_MINIMUM=3.5'], 
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

            // Attempt 1: Ninja (Strawberry Perl edition)
            let result = await runBuild('Ninja', 'build-ninja');

            // Fallback: Visual Studio 17 2022
            if (result !== 0) {
                controller.enqueue(encoder.encode("\n[WARNING] Ninja build failed or Ninja not found. Falling back to Visual Studio...\n"));
                result = await runBuild('Visual Studio 17 2022', 'build-vs', ['-A', 'x64'], ['--', '/m:1']);
            }

            isBuilding = false;
            if (result === 0) {
                controller.enqueue(encoder.encode("\n[SUCCESS] Build completed successfully. Binary is ready.\n"));
            } else {
                controller.enqueue(encoder.encode(`\n[FAILED] Build process failed after all attempts. Final exit code: ${result}\n`));
            }
            controller.close();
        }
    });

    return new Response(stream);
}
