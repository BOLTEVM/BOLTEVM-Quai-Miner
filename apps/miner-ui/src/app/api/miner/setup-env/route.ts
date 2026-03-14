import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => {
                controller.enqueue(encoder.encode(msg + '\n'));
            };

            const runWinget = (cmd: string, args: string[]): Promise<boolean> => {
                return new Promise((resolve) => {
                    const fullArgs = [cmd, ...args];
                    send(`> winget ${fullArgs.join(' ')}`);
                    const child = spawn('winget', fullArgs, { shell: true });

                    child.stdout.on('data', (data) => {
                        send(data.toString());
                    });

                    child.stderr.on('data', (data) => {
                        send('[ERR] ' + data.toString());
                    });

                    child.on('close', (code) => {
                        resolve(code === 0);
                    });
                });
            };

            send('Initializing environment setup for BoltEVM Miner...');

            try {
                // 1. Install CMake
                send('\nInstalling CMake...');
                const cmakeOk = await runWinget('install', ['--id', 'Kitware.CMake', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
                if (cmakeOk) {
                    send('CMake installation triggered.');
                } else {
                    send('[WARN] CMake installation might have failed or is already installed.');
                }

                // 2. Install Strawberry Perl (Official docs requirement)
                send('\nInstalling Strawberry Perl...');
                const perlOk = await runWinget('install', ['--id', 'StrawberryPerl.StrawberryPerl', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
                if (perlOk) {
                    send('Perl installation triggered.');
                } else {
                    send('[WARN] Perl installation might have failed or is already installed.');
                }

                send('\n[SUCCESS] Dependency installation sequence finished.');
                send('NOTE: You may need to RESTART the application or your terminal for PATH changes to take effect.');
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
