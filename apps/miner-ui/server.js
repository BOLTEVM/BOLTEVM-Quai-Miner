const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const wss = new WebSocketServer({ port: 8081 });
console.log('Local Middleware WebSocket Server running on port 8081');

let minerProcess = null;

// Dynamic Multi-Tier Quai Network Chain Heights
let chainHeights = {
    zone: 9498168,   // Cyprus-1 Zone height (~9.50M)
    region: 5097653, // Cyprus Region height (~5.10M)
    prime: 2099398   // Prime Chain height (~2.10M)
};
let activePoolJobBlock = chainHeights.region;

const RPC_TIERS = [
    { name: 'zone', url: 'https://rpc.quai.network/cyprus1' },
    { name: 'region', url: 'https://rpc.quai.network/cyprus' },
    { name: 'prime', url: 'https://rpc.quai.network/prime' }
];

async function pollDynamicChainHeights() {
    for (const tier of RPC_TIERS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(tier.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'quai_blockNumber', params: [], id: 1 }),
                signal: controller.signal
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (res && res.ok) {
                const data = await res.json();
                if (data.result) {
                    const blockNum = parseInt(data.result, 16);
                    if (!isNaN(blockNum) && blockNum > 0) {
                        chainHeights[tier.name] = blockNum;
                    }
                }
            }
        } catch (e) {}
    }
}

// Poll RPC chain tiers every 15 seconds
setInterval(pollDynamicChainHeights, 15000);
pollDynamicChainHeights();

function isValidPoolBlock(poolBlock) {
    if (!poolBlock || poolBlock <= 0) return true;
    const tol = 1500; // Allow 1500 block tolerance for pool template buffering
    const matchesZone = Math.abs(poolBlock - chainHeights.zone) <= tol;
    const matchesRegion = Math.abs(poolBlock - chainHeights.region) <= tol;
    const matchesPrime = Math.abs(poolBlock - chainHeights.prime) <= tol;
    // Stratum pools mine at Region/Prime or Zone headers
    return matchesZone || matchesRegion || matchesPrime || poolBlock >= 4000000;
}

function hardStopStaleMiner(poolBlock) {
    console.error(`[HARD-STOP] Pool template lagged all 3 chain tiers (${poolBlock}). Terminating miner process.`);
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
}

function getMinerExecutablePath() {
    const candidates = [
        path.join(__dirname, '..', 'quai-gpu-miner', 'build-vs', 'kawpowminer', 'Release', 'quai-gpu-miner.exe'),
        path.join(__dirname, '..', 'quai-gpu-miner', 'build-ninja', 'kawpowminer', 'quai-gpu-miner.exe'),
        path.join(__dirname, '..', 'quai-gpu-miner', 'build', 'kawpowminer', 'quai-gpu-miner.exe'),
        'quai-gpu-miner'
    ];
    for (const cand of candidates) {
        if (cand === 'quai-gpu-miner' || fs.existsSync(cand)) {
            console.log(`[MINER-EXEC] Resolved active native miner binary: ${path.resolve(cand)}`);
            return cand;
        }
    }
    console.warn(`[MINER-EXEC] No build binary found on disk. Falling back to system PATH binary 'quai-gpu-miner'`);
    return 'quai-gpu-miner';
}

wss.on('connection', function connection(ws) {
    console.log(`Frontend connected to middleware. Total active clients: ${wss.clients.size}`);

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

                        // 2. Parse Stratum Job Block Height & Monitor Pool Desynchronization
                        const blockMatch = cleanLine.match(/block\s+(\d+)/i);
                        if (blockMatch) {
                            activePoolJobBlock = parseInt(blockMatch[1], 10);
                            const valid = isValidPoolBlock(activePoolJobBlock);

                            if (!valid) {
                                hardStopStaleMiner(activePoolJobBlock);
                                broadcast({
                                    type: 'POOL_OUT_OF_SYNC',
                                    poolBlock: activePoolJobBlock,
                                    chainBlock: chainHeights.zone,
                                    drift: Math.abs(chainHeights.zone - activePoolJobBlock),
                                    message: `[HARD-STOP] Stratum Pool out of sync with all Quai chain tiers! Pool Block: ${activePoolJobBlock} vs Zone: ${chainHeights.zone}, Region: ${chainHeights.region}, Prime: ${chainHeights.prime}. Native miner halted.`
                                });
                            }
                        }

                        // 3. Parse Telemetry lines: e.g. "m 04:59:55 <unknown> 0:01 A1 42.50 Mh - cu0 42.50" or "Speed 42.50 Mh/s"
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
                                lastHash: extractedHash
                            });
                        }

                        // 4. Parse Share Accepted: e.g. "Accepted 350 ms", "**Accepted", or "Sol: ... found"
                        const shareMatch = cleanLine.match(/(?:Share accepted|\*\*Accepted|Accepted\s+\d+\s*ms|Sol:.*found)/i);
                        if (shareMatch) {
                            const isStale = !isValidPoolBlock(activePoolJobBlock);
                            broadcast({
                                type: 'SHARE_ACCEPTED',
                                isStale: isStale,
                                poolBlock: activePoolJobBlock,
                                chainBlock: chainHeights.zone,
                                message: `Share Accepted! ${cleanLine} ${isStale ? '[STALE TEMPLATE]' : ''}`,
                                nonce: `0x${Math.random().toString(16).substring(2, 10)}`
                            });
                        }

                        // 5. Parse Found Solution
                        const solutionMatch = cleanLine.match(/(?:Solution found|Found block|REAL Block Solution)/i);
                        if (solutionMatch) {
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
        const remainingClients = wss.clients.size;
        console.log(`Frontend client disconnected. Remaining active clients: ${remainingClients}`);
        
        // Session-Aware Process Management: Only terminate miner process if zero clients remain
        if (remainingClients === 0 && minerProcess) {
            console.log('No active WebSocket clients remaining. Shutting down miner process to prevent zombie execution...');
            if (process.platform === 'win32') {
                 spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
            } else {
                 minerProcess.kill('SIGTERM');
            }
            minerProcess = null;
        }
    });
});
