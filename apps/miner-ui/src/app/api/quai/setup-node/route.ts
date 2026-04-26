import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST() {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const log = (msg: string) => controller.enqueue(encoder.encode(msg + "\n"));

            log("Starting Quai Node setup for Ubuntu...");

            if (process.platform === 'win32') {
                log("[ERR] Automated node setup is currently only supported on Linux/Ubuntu.");
                log("Please follow the manual guide at: https://github.com/StarkovVlad/quai_node_setup_guide/");
                controller.close();
                return;
            }

            const runCmd = (cmd: string, args: string[], cwd?: string) => {
                return new Promise<number>((resolve) => {
                    log(`> ${cmd} ${args.join(' ')}`);
                    const child = spawn(cmd, args, { cwd });

                    child.stdout.on('data', (data) => log(data.toString().trim()));
                    child.stderr.on('data', (data) => log(`[WARN] ${data.toString().trim()}`));

                    child.on('close', (code) => {
                        resolve(code || 0);
                    });
                });
            };

            // 1. Install Dependencies
            log("--- Installing Dependencies ---");
            const depCode = await runCmd('sudo', ['apt-get', 'update']);
            if (depCode !== 0) { log("[ERR] Failed to update apt."); controller.close(); return; }
            
            await runCmd('sudo', ['apt-get', 'install', '-y', 'git', 'make', 'g++', 'snapd']);
            await runCmd('sudo', ['snap', 'install', 'go', '--classic']);

            // 2. Clone go-quai
            log("--- Cloning go-quai ---");
            const targetDir = path.join(process.cwd(), '../../../go-quai'); // Root of monorepo/external
            if (!fs.existsSync(targetDir)) {
                const cloneCode = await runCmd('git', ['clone', 'https://github.com/dominant-strategies/go-quai', targetDir]);
                if (cloneCode !== 0) { log("[ERR] Failed to clone repository."); controller.close(); return; }
            } else {
                log("Repository already exists. Skipping clone.");
            }

            // 3. Build go-quai
            log("--- Building go-quai ---");
            const buildCode = await runCmd('make', ['go-quai'], targetDir);
            if (buildCode !== 0) { log("[ERR] Build failed."); controller.close(); return; }

            // 4. Config
            log("--- Initializing Configuration ---");
            // Note: config usually requires interactive input, but we can try to run it or provide a default one
            await runCmd('./build/bin/go-quai', ['config'], targetDir);

            log("[SUCCESS] Quai Node successfully initialized.");
            controller.close();
        }
    });

    return new Response(stream);
}
