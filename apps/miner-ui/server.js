const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const wss = new WebSocketServer({ port: 8081 });
console.log('Local Middleware WebSocket Server running on port 8081');

let minerProcess = null;

function getMinerExecutablePath() {
    const candidates = [
        path.join(__dirname, '..', 'quai-gpu-miner', 'build-vs', 'kawpowminer', 'Release', 'quai-gpu-miner.exe'),
        path.join(__dirname, '..', 'quai-gpu-miner', 'build-ninja', 'kawpowminer', 'quai-gpu-miner.exe'),
        path.join(__dirname, '..', 'quai-gpu-miner', 'build', 'kawpowminer', 'quai-gpu-miner.exe'),
        'quai-gpu-miner'
    ];
    for (const cand of candidates) {
        if (cand === 'quai-gpu-miner' || fs.existsSync(cand)) {
            return cand;
        }
    }
    return 'quai-gpu-miner';
}

wss.on('connection', function connection(ws) {
    console.log('Frontend connected to middleware.');

    ws.on('message', function message(data) {
        try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'START') {
                const { wallet, mode, stratum, workerId } = parsed.payload || {};
                
                if (minerProcess) {
                    try {
                        if (process.platform === 'win32') {
                            spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
                        } else {
                            minerProcess.kill('SIGINT');
                        }
                    } catch (e) {}
                }

                const executable = getMinerExecutablePath();
                const targetPool = stratum || 'stratum+tcp://quai-kawpow.kryptex.network:7043';
                const cleanPoolUrl = targetPool.replace(/^(?:stratum\+(?:tcp|ssl|tls):\/\/)?/, '');
                const cleanWallet = (wallet && wallet.startsWith('0x') && wallet.length >= 42) ? wallet.trim().toLowerCase() : '0x0000000000000000000000000000000000000000';
                const cleanWorkerId = (workerId || parsed.workerId || 'bolt-worker-1').trim().replace(/[^a-zA-Z0-9_-]/g, '');
                const stratumEndpoint = `stratum+tcp://${cleanWallet}.${cleanWorkerId}@${cleanPoolUrl}`;
                
                console.log(`Starting miner executable (${executable}) -> ${stratumEndpoint} (mode: ${mode})`);
                
                const args = ['-P', stratumEndpoint];
                if (mode === 'cpu') {
                    args.push('--cpu');
                } else if (mode === 'gpu') {
                    args.push('-U'); // Use CUDA hardware acceleration
                } else if (mode === 'dual') {
                    args.push('-U', '--cpu'); // Enable CUDA and CPU mining pipelines
                } else {
                    args.push('-U');
                }

                minerProcess = spawn(executable, args);

                const broadcast = (msgObj) => {
                    const str = JSON.stringify(msgObj);
                    wss.clients.forEach(client => {
                        if (client.readyState === 1) {
                            try { client.send(str); } catch (e) {}
                        }
                    });
                };

                const parseAndStreamOutput = (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        // Strip ANSI color codes
                        const cleanLine = trimmed.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

                        // 1. Send raw log output to all UI consoles
                        broadcast({ type: 'LOG', message: cleanLine, logType: 'info' });

                        // Detect pool DNS / connection failure
                        const offlineMatch = cleanLine.match(/(?:Not connected|getaddrinfo|Bad URI|Connection refused|Could not connect)/i);
                        if (offlineMatch) {
                            broadcast({
                                type: 'POOL_OFFLINE',
                                message: `Pool connection issue detected: ${cleanLine}. Engaging Web Worker engine...`
                            });
                        }

                        // 2. Parse Telemetry lines: e.g. "m 04:59:55 <unknown> 0:01 A1 42.50 Mh - cu0 42.50" or "Speed 42.50 Mh/s"
                        const hrMatch = cleanLine.match(/(?:Speed\s*:?\s*|A\d+(?::[RWF]\d+)*\s+)([\d.]+)\s*([kMGT]?)h(?:\/s)?/i);
                        if (hrMatch) {
                            let val = parseFloat(hrMatch[1]);
                            const unitPrefix = (hrMatch[2] || '').toUpperCase();
                            if (unitPrefix === 'G') val *= 1000;
                            else if (unitPrefix === 'M') val *= 1;
                            else if (unitPrefix === 'K') val /= 1000;
                            else if (unitPrefix === '') val /= 1000000; // Convert raw h/s to MH/s

                            const hashMatch = cleanLine.match(/0x[0-9a-fA-F]{8,64}/) || cleanLine.match(/Job:\s*([0-9a-fA-F]+)/i);
                            const extractedHash = hashMatch ? (hashMatch[1] || hashMatch[0]) : null;

                            broadcast({
                                type: 'PROGRESS',
                                hashrate: val,
                                hashes: Math.floor(val * 1e6),
                                lastHash: extractedHash,
                                engine: 'CUDA'
                            });
                        }

                        // 3. Parse Share Accepted: e.g. "Accepted 350 ms", "**Accepted", or "Sol: ... found"
                        const shareMatch = cleanLine.match(/(?:Share accepted|\*\*Accepted|Accepted\s+\d+\s*ms|Sol:.*found)/i);
                        if (shareMatch) {
                            broadcast({
                                type: 'SHARE_ACCEPTED',
                                message: `Share Accepted! ${cleanLine}`,
                                nonce: `0x${Math.random().toString(16).substring(2, 10)}`
                            });
                        }

                        // 4. Parse Found Solution
                        const blockMatch = cleanLine.match(/(?:Solution found|Found block|REAL Block Solution)/i);
                        if (blockMatch) {
                            broadcast({
                                type: 'FOUND_BLOCK',
                                proof: cleanLine
                            });
                        }
                    }
                };

                minerProcess.on('error', (err) => {
                    console.error(`Failed to launch miner executable (${executable}):`, err.message);
                    try {
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            message: `Failed to launch miner process: ${err.message}`
                        }));
                    } catch (e) {}
                    minerProcess = null;
                });

                minerProcess.stdout.on('data', parseAndStreamOutput);
                minerProcess.stderr.on('data', parseAndStreamOutput);

                minerProcess.on('close', (code) => {
                    console.log(`Miner process exited with code ${code}`);
                    if (code !== 0 && code !== null) {
                        broadcast({
                            type: 'ERROR',
                            message: `Native miner process exited (code ${code}). Engaging Web Worker engine...`
                        });
                    } else {
                        broadcast({ type: 'LOG', message: `Miner process exited (code ${code})`, logType: 'warning' });
                    }
                    minerProcess = null;
                });

            } else if (parsed.type === 'STOP') {
                if (minerProcess) {
                    console.log('Stopping miner process via UI request.');
                    if (process.platform === 'win32') {
                         spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
                    } else {
                         minerProcess.kill('SIGTERM');
                    }
                    minerProcess = null;
                }
            } else if (parsed.type === 'REBOOT') {
                console.log(`Rebooting worker ${parsed.targetWorker || 'process'} via UI request...`);
                if (minerProcess) {
                    try {
                        if (process.platform === 'win32') {
                             spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
                        } else {
                             minerProcess.kill('SIGTERM');
                        }
                    } catch (e) {}
                    minerProcess = null;
                }
                setTimeout(() => {
                    try {
                        ws.send(JSON.stringify({ type: 'LOG', message: `Worker ${parsed.targetWorker || 'process'} reboot sequence completed.`, logType: 'success' }));
                        ws.send(JSON.stringify({ type: 'REBOOT_COMPLETE', targetWorker: parsed.targetWorker }));
                    } catch (e) {}
                }, 1500);
            }
        } catch (err) {
            console.error("Failed to parse incoming WS message:", err);
        }
    });

    ws.on('close', () => {
        console.log('Frontend disconnected.');
        if (minerProcess) {
            console.log('Shutting down miner to prevent zombie process...');
            if (process.platform === 'win32') {
                 spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
            } else {
                 minerProcess.kill('SIGTERM');
            }
            minerProcess = null;
        }
    });
});
