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
                const { wallet, mode } = parsed.payload;
                
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
                console.log(`Starting miner executable (${executable}) with wallet: ${wallet}`);
                
                const args = ['-P', `stratum+tcp://${wallet}@eu.quai.network:3333`];
                if (mode === 'cpu') args.push('--cpu');
                if (mode === 'gpu') args.push('-U'); // Use CUDA only

                minerProcess = spawn(executable, args);

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

                minerProcess.stdout.on('data', (data) => {
                    const out = data.toString();
                    process.stdout.write(out);
                    
                    const hrMatch = out.match(/Speed:\s+([\d.]+)\s+(M|G)H\/s/i);
                    const blockMatch = out.match(/New job/i) || out.match(/Solution found/i);

                    if (hrMatch) {
                        let val = parseFloat(hrMatch[1]);
                        if (hrMatch[2].toUpperCase() === 'G') {
                            val *= 1000;
                        }
                        
                        ws.send(JSON.stringify({
                            type: 'PROGRESS',
                            hashrate: val,
                            hashes: Math.floor(val * 1e6),
                            lastHash: 'n/a'
                        }));
                    }
                    
                    if (blockMatch && blockMatch[0].toLowerCase().includes('solution')) {
                        ws.send(JSON.stringify({
                            type: 'FOUND_BLOCK',
                            proof: 'Parsed Block Solution'
                        }));
                    }
                });

                minerProcess.stderr.on('data', (data) => {
                    console.error(`Miner ERR: ${data}`);
                });

                minerProcess.on('close', (code) => {
                    console.log(`Miner process exited with code ${code}`);
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
