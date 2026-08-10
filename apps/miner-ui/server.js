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
                    args.push('-U', '--cuda-grid-size', '8192', '--cuda-parallel-hash', '4');
                    args.push('--cuda-devices', '0');
                } else if (mode === 'dual') {
                    args.push('-U', '--cuda-grid-size', '8192', '--cuda-parallel-hash', '4', '--cpu');
                    args.push('--cuda-devices', '0');
                } else {
                    args.push('-U', '--cuda-grid-size', '8192', '--cuda-parallel-hash', '4');
                    args.push('--cuda-devices', '0');
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

                        // Detect pool DNS / connection failure
                        const offlineMatch = cleanLine.match(/(?:Not connected|getaddrinfo|Bad URI|Connection refused|Could not connect)/i);
                        if (offlineMatch) {
                            broadcast({
                                type: 'POOL_OFFLINE',
                                message: `Pool connection issue detected: ${cleanLine}`
                            });
                        }

                        // 1. Dual-Stage Telemetry Parser
                        // Stage A: Parse Farm Summary Total (e.g. "A1 42.50 Mh" or "Speed 42.50 Mh/s")
                        const farmHrMatch = cleanLine.match(/(?:Speed\s*:?\s*|A\d+(?::[RWF]\d+)*\s+)([\d.]+)\s*([kMGT]?)h(?:\/s)?/i);
                        let totalHashrate = null;
                        let unitPrefix = 'M';

                        if (farmHrMatch) {
                            let rawVal = parseFloat(farmHrMatch[1]);
                            unitPrefix = (farmHrMatch[2] || '').toUpperCase();
                            if (unitPrefix === 'G') totalHashrate = rawVal * 1000;
                            else if (unitPrefix === 'M') totalHashrate = rawVal * 1;
                            else if (unitPrefix === 'K') totalHashrate = rawVal / 1000;
                            else if (unitPrefix === '') totalHashrate = rawVal / 1000000;
                        }

                        // Stage B: Extract Individual Device Hashrates (cu0 42.50, cu1 42.50, cl0 42.50, cp0 18.50)
                        const devices = [];
                        const deviceRegex = /(cu|cl|cp)(\d+)\s+([\d.]+)(?:\s*([kMGT]?)h)?/gi;
                        let devMatch;
                        while ((devMatch = deviceRegex.exec(cleanLine)) !== null) {
                            const devType = devMatch[1].toLowerCase();
                            const devId = parseInt(devMatch[2], 10);
                            let devVal = parseFloat(devMatch[3]);
                            const devUnit = (devMatch[4] || unitPrefix).toUpperCase();

                            let devMHs = devVal;
                            if (devUnit === 'G') devMHs = devVal * 1000;
                            else if (devUnit === 'M') devMHs = devVal * 1;
                            else if (devUnit === 'K') devMHs = devVal / 1000;
                            else if (devUnit === '') devMHs = devVal / 1000000;

                            devices.push({
                                id: `${devType}${devId}`,
                                type: devType === 'cu' ? 'CUDA' : devType === 'cl' ? 'OpenCL' : 'CPU',
                                hashrate: devMHs
                            });
                        }

                        // Stage C: Fallback to Device Sum if Farm Total is 0/null
                        if (devices.length > 0) {
                            const deviceSum = devices.reduce((acc, d) => acc + d.hashrate, 0);
                            if (deviceSum > 0 && (totalHashrate === null || totalHashrate === 0)) {
                                totalHashrate = deviceSum;
                            }
                        }

                        // Broadcast PROGRESS only when positive hashrate (> 0) is verified
                        if (totalHashrate !== null && totalHashrate > 0) {
                            const hashMatch = cleanLine.match(/0x[0-9a-fA-F]{8,64}/) || cleanLine.match(/Job:\s*([0-9a-fA-F]+)/i);
                            const extractedHash = hashMatch ? (hashMatch[1] || hashMatch[0]) : null;

                            broadcast({
                                type: 'PROGRESS',
                                hashrate: totalHashrate,
                                hashes: Math.floor(totalHashrate * 1e6),
                                devices: devices,
                                lastHash: extractedHash,
                                engine: 'CUDA'
                            });
                        }

                        // 2. Parse Share Accepted
                        const shareMatch = cleanLine.match(/(?:Share accepted|\*\*Accepted|Accepted\s+\d+\s*ms|Sol:.*found)/i);
                        if (shareMatch) {
                            const pingMatch = cleanLine.match(/(\d+)\s*ms/);
                            const ping = pingMatch ? `${pingMatch[1]} ms` : 'OK';
                            const nonceMatch = cleanLine.match(/(?:nonce|sol|job)[\s:]*(0x[0-9a-fA-F]+|[0-9a-fA-F]{8,64})/i);
                            const realNonce = nonceMatch ? nonceMatch[1] : undefined;

                            broadcast({
                                type: 'SHARE_ACCEPTED',
                                message: `[Pool Response] Share Accepted (${ping}) - ${cleanLine}`,
                                nonce: realNonce,
                                latency: ping
                            });
                        }

                        // 3. Parse Found Solution
                        const blockMatch = cleanLine.match(/(?:Solution found|Found block|REAL Block Solution)/i);
                        if (blockMatch) {
                            broadcast({
                                type: 'FOUND_BLOCK',
                                proof: cleanLine
                            });
                        }

                        // 4. Send non-telemetry log output to UI console
                        if (!farmHrMatch) {
                            broadcast({ type: 'LOG', message: cleanLine, logType: shareMatch ? 'success' : blockMatch ? 'success' : offlineMatch ? 'warning' : 'info' });
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
                            message: `Native miner process exited with code ${code}. Check GPU drivers and pool configuration.`
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
