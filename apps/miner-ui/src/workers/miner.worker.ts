// miner.worker.ts - Hardware Mining Worker (100% Integral Data Pipeline)
let ws: WebSocket | null = null;

self.onmessage = (e: MessageEvent) => {
    const { type, intensity, wallet, mode, gpus, cpu, profile, stratum } = e.data;

    if (type === 'START') {
        startMining({ intensity, wallet, mode, gpus, cpu, profile, stratum });
    } else if (type === 'STOP') {
        stopMining();
    }
};

function stopMining() {
    if (ws) {
        try {
            ws.send(JSON.stringify({ type: 'STOP' }));
            ws.close();
        } catch (e) {}
        ws = null;
    }
}

async function startMining(payload: any) {
    stopMining();

    try {
        ws = new WebSocket('ws://localhost:8081');

        ws.onopen = () => {
            ws?.send(JSON.stringify({ type: 'START', payload }));
            self.postMessage({ type: 'LOG', message: '[WS] Connected to Local Native Miner Daemon.', logType: 'success' });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'ERROR' || data.type === 'POOL_OFFLINE') {
                    self.postMessage({ type: 'LOG', message: data.message || 'Pool or daemon connection error.', logType: 'error' });
                    self.postMessage(data);
                } else if (data.type === 'PROGRESS') {
                    if (typeof data.hashrate === 'number' && data.hashrate > 0) {
                        self.postMessage({ ...data, engine: 'CUDA' });
                    }
                } else if (['FOUND_BLOCK', 'LOG', 'SHARE_ACCEPTED'].includes(data.type)) {
                    self.postMessage({ ...data, engine: 'CUDA' });
                }
            } catch (err) {
                console.error("Worker message parse error:", err);
            }
        };

        ws.onerror = () => {
            self.postMessage({
                type: 'LOG',
                message: '[WS Error] Could not connect to local miner daemon (ws://localhost:8081). Ensure server.js is running.',
                logType: 'error'
            });
        };

        ws.onclose = () => {
            self.postMessage({ type: 'LOG', message: '[WS] Connection to native miner daemon closed.', logType: 'warning' });
        };
    } catch (e: any) {
        self.postMessage({
            type: 'LOG',
            message: `[WS Exception] Failed to initialize WebSocket worker: ${e.message}`,
            logType: 'error'
        });
    }
}
