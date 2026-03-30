import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: Request) {
    const encoder = new TextEncoder();
    const buildPath = path.resolve(process.cwd(), '../../apps/quai-gpu-miner');
    const platform = process.platform;

    if (!fs.existsSync(buildPath)) {
        return NextResponse.json({ error: 'Miner source not found' }, { status: 404 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'));

            const findVcvars = () => {
                if (platform !== 'win32') return null;
                const vsPaths = [
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat'
                ];
                return vsPaths.find(p => fs.existsSync(p)) ? `"${vsPaths.find(p => fs.existsSync(p))}"` : null;
            };

            const detectVsGenerator = (): string => {
                const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
                if (fs.existsSync(vswhere)) {
                    try {
                        const { execSync } = require('child_process');
                        const output = execSync(`"${vswhere}" -latest -property installationVersion`, { encoding: 'utf8' }).trim();
                        const major = parseInt(output.split('.')[0], 10);
                        if (major >= 17) return 'Visual Studio 17 2022';
                        if (major >= 16) return 'Visual Studio 16 2019';
                    } catch {}
                }
                return 'Visual Studio 15 2017';
            };

            const vcvars = findVcvars();

            const runCommand = (cmd: string, args: string[], cwd: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    let finalCmd = cmd;
                    let finalArgs = args;
                    let windowsVerbatimOptions = {};

                    if (platform === 'win32' && vcvars) {
                        const escapedArgs = args.map(a => (a.includes(' ') && !a.startsWith('"')) ? `"${a}"` : a);
                        finalCmd = 'cmd.exe';
                        // Wrap the entire command chain in outer quotes for cmd.exe /s /c "..."
                        finalArgs = ['/s', '/c', `"${vcvars} && ${cmd} ${escapedArgs.join(' ')}"`];
                        windowsVerbatimOptions = { windowsVerbatimArguments: true };
                    }

                    const customEnv: NodeJS.ProcessEnv = {
                        ...process.env,
                        // Tell CMake's find_package / policy system we are modern
                        CMAKE_POLICY_VERSION_MINIMUM: '3.5',
                        // Suppress Hunter cache server SSL errors at the curl level:
                        // HUNTER_USE_CACHE_SERVERS=NO is passed as a -D arg but this
                        // env var provides a belt-and-suspenders guard.
                        HUNTER_USE_CACHE_SERVERS: 'NO',
                    };
                    if (platform === 'win32' && vcvars) {
                        const vcvarsRaw = vcvars.replace(/"/g, '');
                        customEnv['VS160COMNTOOLS'] = path.dirname(vcvarsRaw) + '\\';
                        // Dynamic Bintray CDN mirror bypass handled natively by cmake/Hunter/patch-hunter.cmake
                    }

                    send(`\n> ${cmd} ${args.join(' ')}`);
                    const child = spawn(finalCmd, finalArgs, {
                        cwd,
                        shell: platform !== 'win32',
                        ...windowsVerbatimOptions,
                        env: customEnv
                    });

                    child.stdout.on('data', (d) => send(d.toString()));
                    child.stderr.on('data', (d) => send(d.toString()));
                    child.on('close', (code) => resolve(code === 0));
                });
            };

            try {
                send(`Starting automated build for BoltEVM Quai Miner on ${platform}...`);
                
                // 1. Git submodule update
                if (!await runCommand('git', ['submodule', 'update', '--init', '--recursive'], buildPath)) {
                    throw new Error('Git submodule update failed');
                }

                // 2. Create build dir and clear old CMake cache safely
                const buildDir = path.join(buildPath, 'build');
                if (!fs.existsSync(buildDir)) {
                    fs.mkdirSync(buildDir, { recursive: true });
                    send('Created build directory.');
                } else {
                    try {
                        const cacheFile = path.join(buildDir, 'CMakeCache.txt');
                        const cMakeFiles = path.join(buildDir, 'CMakeFiles');
                        if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
                        if (fs.existsSync(cMakeFiles)) fs.rmSync(cMakeFiles, { recursive: true, force: true });
                        send('Cleared old CMake cache to prevent generator conflicts.');
                    } catch (e: any) {
                        send(`Warning: Could not fully clear CMake cache (${e.message}). The build will proceed.`);
                    }
                }

                // 3. CMake Configure
                // -DHUNTER_USE_CACHE_SERVERS=NO  : Disables Hunter cache server lookups.
                //    The cache.hunter.sh CDN has an expired SSL cert (curl error 60),
                //    which causes a hard fatal error. We build from source instead.
                // -Wno-dev                        : Suppresses CMake deprecation warnings
                //    from Hunter's legacy internal files (cmake_minimum_required < 3.5).
                // -DCMAKE_POLICY_DEFAULT_CMP0048=NEW : Silences VERSION policy warnings.
                let cmakeArgs = [
                    '..',
                    '-DCMAKE_BUILD_TYPE=Release',
                    '-DHUNTER_USE_CACHE_SERVERS=NO',
                    '-DHUNTER_JOBS_NUMBER=4',
                    '-DCMAKE_POLICY_DEFAULT_CMP0048=NEW',
                    '-Wno-dev',
                ];
                if (platform === 'win32') {
                    const gen = detectVsGenerator();
                    cmakeArgs.push('-G', gen, '-A', 'x64');
                    // Disable CUDA on Windows to avoid nvcc dependency if CUDA is not installed
                    cmakeArgs.push('-DETHASHCUDA=OFF');
                }

                if (!await runCommand('cmake', cmakeArgs, buildDir)) {
                    throw new Error('CMake configuration failed');
                }

                // 4. Build
                if (platform === 'win32') {
                    if (!await runCommand('cmake', ['--build', '.', '--config', 'Release'], buildDir)) {
                        throw new Error('Build failed');
                    }
                } else {
                    const cpuCount = os.cpus().length;
                    if (!await runCommand('make', [`-j${cpuCount}`], buildDir)) {
                        throw new Error('Make failed');
                    }
                }

                send('\n[SUCCESS] BoltEVM Miner built successfully!');
                controller.close();
            } catch (err: any) {
                send(`\n[FATAL] Build aborted: ${err.message}`);
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
