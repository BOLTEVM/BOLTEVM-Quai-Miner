const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocketServer({ port: 8081 });
console.log('Local Middleware WebSocket Server running on port 8081');

let minerProcess = null;

wss.on('connection', function connection(ws) {
    console.log('Frontend connected to middleware.');

    ws.on('message', function message(data) {
        try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'START') {
                const { wallet, mode } = parsed.payload;
                
                if (minerProcess) {
                    minerProcess.kill('SIGINT');
                }

                console.log(`Starting quai-gpu-miner globally with wallet: ${wallet}`);
                
                // User requested shipping globally: spawn quai-gpu-miner from PATH
                const args = ['-P', `stratum+tcp://${wallet}@eu.quai.network:3333`];
                if (mode === 'cpu') args.push('--cpu');
                if (mode === 'gpu') args.push('-U'); // Use CUDA only

                minerProcess = spawn('quai-gpu-miner', args);

                minerProcess.stdout.on('data', (data) => {
                    const out = data.toString();
                    process.stdout.write(out);
                    
                    // Regex parse pseudo-hashrate or real hashrate
                    // Example regex adapting standard kawpowminer output
                    const hrMatch = out.match(/Speed:\s+([\d.]+)\s+(M|G)H\/s/i);
                    const blockMatch = out.match(/New job/i) || out.match(/Solution found/i);

                    if (hrMatch) {
                        let val = parseFloat(hrMatch[1]);
                        if (hrMatch[2].toUpperCase() === 'G') {
                            val *= 1000; // Normalise to MH/s
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
