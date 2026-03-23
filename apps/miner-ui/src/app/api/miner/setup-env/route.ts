import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
    const encoder = new TextEncoder();
    const platform = process.platform;

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => {
                controller.enqueue(encoder.encode(msg + '\n'));
            };

            const runPkgManager = (cmd: string, args: string[]): Promise<boolean> => {
                return new Promise((resolve) => {
                    const fullArgs = [cmd, ...args];
                    const exe = platform === 'win32' ? 'winget' : 'sudo';
                    const finalArgs = platform === 'win32' ? fullArgs : ['apt-get', ...fullArgs];
                    
                    send(`> ${exe} ${finalArgs.join(' ')}`);
                    const child = spawn(exe, finalArgs, { shell: true });

                    child.stdout.on('data', (data) => send(data.toString()));
                    child.stderr.on('data', (data) => send(data.toString()));
                    child.on('close', (code) => resolve(code === 0));
                });
            };

            send(`Initializing environment setup for BoltEVM Miner on ${platform}...`);

            try {
                if (platform === 'win32') {
                    send('\nInstalling Win32 Dependencies via winget...');
                    await runPkgManager('install', ['--id', 'Kitware.CMake', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
                    await runPkgManager('install', ['--id', 'StrawberryPerl.StrawberryPerl', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
                } else if (platform === 'linux') {
                    send('\nInstalling Linux Dependencies via apt-get...');
                    send('NOTE: This may require sudo password if not configured for passwordless sudo.');
                    
                    // Update index first
                    await runPkgManager('update', ['-y']);
                    
                    // Install build-essential, cmake, libssl-dev, git
                    const success = await runPkgManager('install', ['-y', 'cmake', 'build-essential', 'libssl-dev', 'git']);
                    
                    if (!success) {
                        send('\n[WARN] Installation failed. You may need to run this manually:');
                        send('sudo apt-get update && sudo apt-get install -y cmake build-essential libssl-dev git');
                    }
                }

                send('\n[SUCCESS] Dependency setup attempt finished.');
                send('NOTE: You may need to RESTART the application or your terminal for changes to take effect.');
                controller.close();
            } catch (err: any) {
                send(`\n[FATAL] Setup failed: ${err.message}`);
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
