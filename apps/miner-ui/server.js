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
                const { wallet, mode, stratum } = parsed.payload || {};
                
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
                const targetPool = stratum || 'stratum+tcp://quai.pool.bolt-evm.com:3333';
                const cleanPoolUrl = targetPool.replace('stratum+tcp://', '');
                const stratumEndpoint = `stratum+tcp://${wallet || '0x0'}@${cleanPoolUrl}`;
                
                console.log(`Starting miner executable (${executable}) -> ${stratumEndpoint}`);
                
                const args = ['-P', stratumEndpoint];
                if (mode === 'cpu') args.push('--cpu');
                if (mode === 'gpu') args.push('-U'); // Use CUDA only

                minerProcess = spawn(executable, args);

                const parseAndStreamOutput = (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        // 1. Send raw log output to UI console
                        try {
                            ws.send(JSON.stringify({ type: 'LOG', message: trimmed, logType: 'info' }));
                        } catch (e) {}

                        // 2. Parse Hashrate telemetry: e.g. "Speed  42.50 Mh/s" or "Speed: 42.50 MH/s"
                        const hrMatch = trimmed.match(/Speed\s*:?\s*([\d.]+)\s*([kMGT]?)H\/s/i);
                        if (hrMatch) {
                            let val = parseFloat(hrMatch[1]);
                            const unitPrefix = hrMatch[2].toUpperCase();
                            if (unitPrefix === 'G') val *= 1000;
                            if (unitPrefix === 'K') val /= 1000;

                            try {
                                ws.send(JSON.stringify({
                                    type: 'PROGRESS',
                                    hashrate: val,
                                    hashes: Math.floor(val * 1e6),
                                    lastHash: trimmed.substring(0, 12)
                                }));
                            } catch (e) {}
                        }

                        // 3. Parse Share Accepted: e.g. "Accepted 350 ms" or "Share accepted"
                        const shareMatch = trimmed.match(/(?:Share accepted|\*\*Accepted|Accepted\s+\d+\s*ms)/i);
                        if (shareMatch) {
                            try {
                                ws.send(JSON.stringify({
                                    type: 'SHARE_ACCEPTED',
                                    message: trimmed,
                                    nonce: Math.floor(Math.random() * 0xffffffff).toString(16)
                                }));
                            } catch (e) {}
                        }

                        // 4. Parse Found Solution
                        const blockMatch = trimmed.match(/(?:Solution found|Found block|REAL Block Solution)/i);
                        if (blockMatch) {
                            try {
                                ws.send(JSON.stringify({
                                    type: 'FOUND_BLOCK',
                                    proof: trimmed
                                }));
                            } catch (e) {}
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
                    try {
                        ws.send(JSON.stringify({ type: 'LOG', message: `Miner process exited (code ${code})`, logType: 'warning' }));
                    } catch (e) {}
                    minerProcess = null;
                });

            } else if (parsed.type === 'STOP') {
                if (minerProcess) {
                    console.log('Stopping miner process via UI request.');
                    // On Windows, child_process.kill() might leave zombie native processes.
                    // We use taskkill if process is Win32
                    if (process.platform === 'win32') {
                         spawn('taskkill', ['/pid', minerProcess.pid, '/f', '/t']);
                    } else {
                         minerProcess.kill('SIGTERM');
                    }
                    minerProcess = null;
                }
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
