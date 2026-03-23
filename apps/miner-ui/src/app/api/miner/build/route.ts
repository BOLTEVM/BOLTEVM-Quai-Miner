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

            // L-5 FIX: Hoist vcvars resolution outside runCommand to avoid per-call filesystem scans
            const vcvars = findVcvars();

            const runCommand = (cmd: string, args: string[], cwd: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    let finalCmd = cmd;
                    let finalArgs = args;

                    if (platform === 'win32' && vcvars) {
                        finalCmd = 'cmd.exe';
                        finalArgs = ['/c', `${vcvars} && ${cmd} ${args.join(' ')}`];
                    }

                    send(`\n> ${cmd} ${args.join(' ')}`);
                    const child = spawn(finalCmd, finalArgs, {
                        cwd,
                        shell: true,
                        env: { ...process.env, CMAKE_POLICY_VERSION_MINIMUM: '3.5' }
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

                // 2. Create build dir
                const buildDir = path.join(buildPath, 'build');
                if (!fs.existsSync(buildDir)) {
                    fs.mkdirSync(buildDir);
                    send('Created build directory.');
                }

                // 3. CMake Configure
                let cmakeArgs = ['..', '-DCMAKE_BUILD_TYPE=Release'];
                // L-6 FIX: Do NOT wrap gen in extra quotes — spawn handles escaping.
                // The nested "\'generator name'\" was causing CMake to report "No such generator"
                if (platform === 'win32') {
                    const gen = detectVsGenerator();
                    cmakeArgs.push('-G', gen, '-A', 'x64');
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
