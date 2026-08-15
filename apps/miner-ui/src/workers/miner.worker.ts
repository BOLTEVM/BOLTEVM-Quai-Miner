// miner.worker.ts - Hardened Hardware & Honest Crash-State Mining Worker Engine
let ws: WebSocket | null = null;

// Telemetry State Machine
enum MinerState {
    DISCONNECTED = 'DISCONNECTED',
    NATIVE_WARMUP = 'NATIVE_WARMUP',
    NATIVE_ACTIVE = 'NATIVE_ACTIVE',
    MINER_OFFLINE = 'MINER_OFFLINE'
}

let currentState: MinerState = MinerState.DISCONNECTED;
let nativeMinerStartedAt: number = 0;
let lastNativeNonZeroTime: number = 0;
let stallWatchdogInterval: ReturnType<typeof setInterval> | null = null;

// Configuration Constants
const WARMUP_HYSTERESIS_MS = 20000; // 20-second initial DAG generation grace period
const STALL_TIMEOUT_MS = 5000;       // 5-second zero-hashrate auto-recovery threshold

self.onmessage = (e: MessageEvent) => {
    const { type, intensity, wallet, mode, gpus, cpu, profile, stratum, workerId, pool } = e.data;

    if (type === 'START') {
        startMining({ intensity, wallet, mode, gpus, cpu, profile, stratum, workerId, pool });
    } else if (type === 'STOP') {
        stopMining();
    }
};

function stopMining() {
    if (stallWatchdogInterval) {
        clearInterval(stallWatchdogInterval);
        stallWatchdogInterval = null;
    }
    if (ws) {
        try {
            ws.send(JSON.stringify({ type: 'STOP' }));
            ws.close();
        } catch (e) {}
        ws = null;
    }
    currentState = MinerState.DISCONNECTED;
}

async function startMining(payload: any) {
    stopMining();

    let wsConnected = false;
    nativeMinerStartedAt = Date.now();
    lastNativeNonZeroTime = 0;
    currentState = MinerState.NATIVE_WARMUP;

    // Emit initial warmup status — no fake hashrates
    self.postMessage({
        type: 'PROGRESS',
        hashrate: 0,
        hashes: 0,
        lastHash: 'warming-up'
    });

    try {
        ws = new WebSocket('ws://localhost:8081');

        ws.onopen = () => {
            wsConnected = true;
            ws?.send(JSON.stringify({ type: 'START', payload }));
            self.postMessage({
                type: 'LOG',
                message: '[WS] Connected to Local Native Miner Daemon. Warm-up & DAG generation initiated...',
                logType: 'success'
            });
            
            // Start watchdog to monitor potential stalls
            startStallWatchdog(payload);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const isMinerExitedLog = data.type === 'LOG' && typeof data.message === 'string' && data.message.includes('Miner process exited');

                if (data.type === 'ERROR' || data.type === 'POOL_OFFLINE' || isMinerExitedLog) {
                    self.postMessage({
                        type: 'LOG',
                        message: data.message || 'Pool or daemon connection error.',
                        logType: 'warning'
                    });
                    reportMinerOffline('Native miner process exited or pool connection failed.');
                    return;
                }

                if (data.type === 'PROGRESS') {
                    handleNativeProgress(data, payload);
                } else if (['FOUND_BLOCK', 'LOG', 'SHARE_ACCEPTED'].includes(data.type)) {
                    self.postMessage(data);
                }
            } catch (err) {
                console.error("Worker message parse error:", err);
            }
        };

        ws.onerror = () => {
            if (!wsConnected) {
                self.postMessage({
                    type: 'LOG',
                    message: '[WS] Failed to connect to native daemon. Miner is offline.',
                    logType: 'warning'
                });
                reportMinerOffline('Could not connect to native miner daemon on ws://localhost:8081.');
            }
        };

        ws.onclose = () => {
            if (currentState !== MinerState.MINER_OFFLINE) {
                self.postMessage({
                    type: 'LOG',
                    message: '[WS] Daemon connection closed. Miner is offline.',
                    logType: 'warning'
                });
                reportMinerOffline('WebSocket connection to miner daemon was closed.');
            }
        };
    } catch (e) {
        reportMinerOffline('Failed to initialize WebSocket connection.');
    }
}

function handleNativeProgress(data: any, payload: any) {
    const rawHashrate = data.hashrate || 0;
    const now = Date.now();

    if (rawHashrate > 0) {
        lastNativeNonZeroTime = now;

        // Transition from NATIVE_WARMUP to NATIVE_ACTIVE
        if (currentState !== MinerState.NATIVE_ACTIVE) {
            currentState = MinerState.NATIVE_ACTIVE;
            self.postMessage({
                type: 'LOG',
                message: '[Engine] Native GPU pipeline active & producing hashes.',
                logType: 'success'
            });
        }

        // Forward live native progress
        self.postMessage(data);
    } else {
        // rawHashrate === 0
        if (currentState === MinerState.NATIVE_WARMUP) {
            // HYSTERESIS: Ignore zero-hashrate pulses during initial DAG generation (~15-20s)
            const elapsed = now - nativeMinerStartedAt;
            if (elapsed > WARMUP_HYSTERESIS_MS) {
                self.postMessage({
                    type: 'LOG',
                    message: `[Stall] Native miner stayed at 0.0 MH/s for >${WARMUP_HYSTERESIS_MS / 1000}s during warm-up.`,
                    logType: 'warning'
                });
                reportMinerOffline('Native miner failed to produce hashes after DAG generation window.');
            }
        } else if (currentState === MinerState.NATIVE_ACTIVE) {
            // Native miner dropped to 0.0 MH/s after being active
            const stallDuration = now - lastNativeNonZeroTime;
            if (stallDuration > STALL_TIMEOUT_MS) {
                self.postMessage({
                    type: 'LOG',
                    message: `[Stall] Native miner hashrate dropped to 0.0 MH/s for >${STALL_TIMEOUT_MS / 1000}s.`,
                    logType: 'warning'
                });
                reportMinerOffline('Native miner stalled — hashrate dropped to zero.');
            }
        }
    }
}

function startStallWatchdog(payload: any) {
    if (stallWatchdogInterval) clearInterval(stallWatchdogInterval);

    stallWatchdogInterval = setInterval(() => {
        const now = Date.now();

        if (currentState === MinerState.NATIVE_WARMUP) {
            if (now - nativeMinerStartedAt > WARMUP_HYSTERESIS_MS && lastNativeNonZeroTime === 0) {
                self.postMessage({
                    type: 'LOG',
                    message: '[Watchdog] Native warm-up window exceeded without non-zero telemetry.',
                    logType: 'warning'
                });
                reportMinerOffline('Watchdog: no non-zero hashrate during warm-up window.');
            }
        } else if (currentState === MinerState.NATIVE_ACTIVE) {
            if (now - lastNativeNonZeroTime > STALL_TIMEOUT_MS) {
                self.postMessage({
                    type: 'LOG',
                    message: `[Watchdog] Native miner stall detected (> ${STALL_TIMEOUT_MS / 1000}s without non-zero hashrate).`,
                    logType: 'warning'
                });
                reportMinerOffline('Watchdog: native miner stalled.');
            }
        }
    }, 2000);
}

/**
 * Honest crash/offline state — reports 0 MH/s and an ERROR message.
 * No fake hashrates, no fake shares, no deceptive fallback engine.
 */
function reportMinerOffline(reason: string) {
    currentState = MinerState.MINER_OFFLINE;

    // Stop the watchdog — we've already detected the issue
    if (stallWatchdogInterval) {
        clearInterval(stallWatchdogInterval);
        stallWatchdogInterval = null;
    }

    self.postMessage({
        type: 'ERROR',
        message: `[MINER OFFLINE] ${reason} Check hardware, pool connection, and miner binary.`
    });

    // Emit a single 0 MH/s progress so dashboard shows honest state
    self.postMessage({
        type: 'PROGRESS',
        hashrate: 0,
        hashes: 0,
        lastHash: 'offline'
    });
}
