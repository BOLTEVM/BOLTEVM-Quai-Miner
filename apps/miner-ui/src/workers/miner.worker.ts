// miner.worker.ts - Hardware Miner Telemetry Worker
// Connects to the local native miner middleware via WebSocket.

let ws: WebSocket | null = null;

self.onmessage = (e: MessageEvent) => {
    const { type, intensity, wallet, mode, gpus, cpu, profile } = e.data;

    if (type === 'START') {
        startMining(intensity, wallet, mode, gpus, cpu, profile);
    } else if (type === 'STOP') {
        if (ws) {
            ws.send(JSON.stringify({ type: 'STOP' }));
            ws.close();
            ws = null;
        }
    }
};

async function startMining(intensity: string, wallet: string, mode: string, gpus: string[], cpu: any, profile: string) {
    if (ws) {
        ws.close();
    }

    try {
        ws = new WebSocket('ws://localhost:8081');
    } catch (e) {
        console.error("Failed to connect to local middleware:", e);
        return;
    }

    ws.onopen = () => {
        // Pass configuration to middleware to spawn the native miner
        ws?.send(JSON.stringify({
            type: 'START',
            payload: { intensity, wallet, mode, gpus, cpu, profile }
        }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'PROGRESS') {
                self.postMessage({
                    type: 'PROGRESS',
                    hashes: data.hashes || 0,
                    hashrate: data.hashrate || 0,
                    lastHash: data.lastHash || ''
                });
            } else if (data.type === 'FOUND_BLOCK') {
                self.postMessage({
                    type: 'FOUND_BLOCK',
                    proof: data.proof || ''
                });
            }
        } catch (err) {
            console.error("Worker generic message parsing error:", err);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket connection to local middleware closed.");
    };
    
    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}
