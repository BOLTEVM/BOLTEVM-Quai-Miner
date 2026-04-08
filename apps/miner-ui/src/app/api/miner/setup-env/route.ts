import { spawn } from 'child_process';

export async function POST() {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode("Initializing automatic toolchain repair...\n"));
            
            const cmd = process.platform === 'win32' 
                ? spawn('winget', ['install', '-e', '--id', 'Kitware.CMake'])
                : spawn('sudo', ['apt-get', 'install', '-y', 'cmake', 'build-essential']);

            cmd.stdout.on('data', (data) => {
                controller.enqueue(encoder.encode(data.toString()));
            });

            cmd.stderr.on('data', (data) => {
                controller.enqueue(encoder.encode(`ERR: ${data.toString()}`));
            });

            cmd.on('close', (code) => {
                if (code === 0) {
                    controller.enqueue(encoder.encode("[SUCCESS] Environment fully configured and ready for build.\n"));
                } else {
                    controller.enqueue(encoder.encode(`[FAILED] Repair exited with code ${code}\n`));
                }
                controller.close();
            });
        }
    });
    return new Response(stream);
}
