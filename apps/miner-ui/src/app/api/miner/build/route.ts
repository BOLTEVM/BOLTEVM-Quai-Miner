import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
    const encoder = new TextEncoder();
    const buildPath = path.resolve(process.cwd(), '../../apps/quai-gpu-miner');

    // Ensure the miner directory exists
    if (!fs.existsSync(buildPath)) {
        return NextResponse.json({ error: 'Miner source not found at ' + buildPath }, { status: 404 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => {
                controller.enqueue(encoder.encode(msg + '\n'));
            };

            const findCmake = () => {
                const paths = [
                    'cmake', // Try PATH first
                    'C:\\Program Files\\CMake\\bin\\cmake.exe',
                    'C:\\Program Files (x86)\\CMake\\bin\\cmake.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\CMake\\bin\\cmake.exe')
                ];
                for (const p of paths) {
                    if (p === 'cmake') continue;
                    if (fs.existsSync(p)) return `"${p}"`;
                }
                return 'cmake';
            };

            const findVcvars = () => {
                const vsPaths = [
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat',
                    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat'
                ];
                for (const p of vsPaths) {
                    if (fs.existsSync(p)) return `"${p}"`;
                }
                return null;
            };

            const cmakeCmd = findCmake();
            const vcvars = findVcvars();

            send('Starting automated build for BoltEVM Quai Miner...');
            send('Directory: ' + buildPath);
            if (vcvars) send('Detected MSVC Toolset: ' + vcvars);
            if (cmakeCmd !== 'cmake') send('Using CMake at: ' + cmakeCmd);

            const runCommand = (cmd: string, args: string[], cwd: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    // If vcvars exists, wrap command in dev environment
                    let finalCmd = cmd;
                    let finalArgs = args;

                    if (vcvars) {
                        const fullCmdString = `${cmd} ${args.join(' ')}`;
                        finalCmd = 'cmd.exe';
                        finalArgs = ['/c', `${vcvars} && ${fullCmdString}`];
                    }

                    send(`\n> ${cmd} ${args.join(' ')}`);
                    const child = spawn(finalCmd, finalArgs, {
                        cwd,
                        shell: true,
                        env: {
                            ...process.env,
                            CMAKE_POLICY_VERSION_MINIMUM: '3.5'
                        }
                    });

                    child.stdout.on('data', (data) => {
                        send(data.toString());
                    });

                    child.stderr.on('data', (data) => {
                        send('[ERR] ' + data.toString());
                    });

                    child.on('close', (code) => {
                        if (code === 0) {
                            send(`Command finished successfully.`);
                            resolve(true);
                        } else {
                            send(`[FAIL] Command exited with code ${code}`);
                            resolve(false);
                        }
                    });
                });
            };

            try {
                // 1. Git submodule update
                const gitOk = await runCommand('git', ['submodule', 'update', '--init', '--recursive'], buildPath);
                if (!gitOk) throw new Error('Git submodule update failed');

                // 2. Create build dir
                const buildDir = path.join(buildPath, 'build');
                if (!fs.existsSync(buildDir)) {
                    fs.mkdirSync(buildDir);
                    send('Created build directory.');
                }

                // 3. CMake Configure
                const cmakeOk = await runCommand(cmakeCmd, ['..', '-G', '"Visual Studio 15 2017"', '-A', 'x64', '-T', 'v140', '-DCMAKE_POLICY_VERSION_MINIMUM=3.5'], buildDir);
                if (!cmakeOk) throw new Error('CMake configuration failed');

                // 4. CMake Build
                const buildOk = await runCommand(cmakeCmd, ['--build', '.', '--config', 'Release'], buildDir);
                if (!buildOk) throw new Error('Build failed');

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
