import { NextResponse } from 'next/server';

const RPC_ZONE   = 'https://rpc.quai.network/cyprus1';
const RPC_REGION = 'https://rpc.quai.network/cyprus';
const RPC_PRIME  = 'https://rpc.quai.network/prime';

const KRYPTEX_INDEX_URL   = 'https://pool.kryptex.com/api/v1/index';
const KRYPTEX_COIN        = 'quai-kawpow';
const KRYPTEX_POOL_BASE   = 'https://pool.kryptex.com/quai-kawpow';

function formatHashrate(hashrate: number): string {
    if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
    if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
    if (hashrate >= 1e9)  return `${(hashrate / 1e9).toFixed(2)}  GH/s`;
    if (hashrate >= 1e6)  return `${(hashrate / 1e6).toFixed(2)}  MH/s`;
    return `${hashrate.toFixed(0)} H/s`;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const cleanAddress = address && address.trim() !== 'undefined' ? address.trim() : '';

    const defaultResponse = {
        networkHashrate: '33.8 GH/s',
        poolWorkers: 343,
        totalPaid: '0.0000 QUAI',
        pendingBalance: '0.0000 QUAI',
        unpaidBalance: '0.0000 QUAI',
        payoutThreshold: '20.00 QUAI',
        activeWorkers: 0,
        minerHashrate: null as string | null,
        blockHeight: 9498168,
        chainHeights: { zone: 9498168, region: 5097653, prime: 2099398 },
        transactions: []
    };

    try {
        // --- Parallel fetch: RPC block heights + pool index + miner data ---
        const fetchBlock = async (url: string): Promise<number> => {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'quai_blockNumber', params: [], id: 1 }),
                    signal: AbortSignal.timeout(4000)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.result) return parseInt(data.result, 16);
                }
            } catch (_) {}
            return 0;
        };

        const fetchPoolIndex = async () => {
            try {
                const res = await fetch(KRYPTEX_INDEX_URL, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });
                if (res.ok) return await res.json();
            } catch (_) {}
            return null;
        };

        const fetchMinerBalance = async (addr: string) => {
            try {
                const res = await fetch(`${KRYPTEX_POOL_BASE}/api/v1/miner/balance/${addr}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });
                if (res.ok) return await res.json();
            } catch (_) {}
            return null;
        };

        const fetchMinerWorkers = async (addr: string) => {
            try {
                const res = await fetch(`${KRYPTEX_POOL_BASE}/api/v3/miner/workers/${addr}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });
                if (res.ok) return await res.json();
            } catch (_) {}
            return null;
        };

        const promises: Promise<unknown>[] = [
            fetchBlock(RPC_ZONE),
            fetchBlock(RPC_REGION),
            fetchBlock(RPC_PRIME),
            fetchPoolIndex(),
        ];

        if (cleanAddress) {
            promises.push(fetchMinerBalance(cleanAddress));
            promises.push(fetchMinerWorkers(cleanAddress));
        }

        const results = await Promise.all(promises);
        const [zoneBlock, regionBlock, primeBlock, poolIndex, minerBalance, minerWorkers] = results as [
            number, number, number, Record<string, unknown> | null,
            Record<string, unknown> | null, Record<string, unknown> | null
        ];

        // --- Parse pool index ---
        let networkHashrate = defaultResponse.networkHashrate;
        let poolWorkers = defaultResponse.poolWorkers;
        if (poolIndex && poolIndex[KRYPTEX_COIN]) {
            const coinData = poolIndex[KRYPTEX_COIN] as { hashrate?: number; workers?: number };
            if (typeof coinData.hashrate === 'number' && coinData.hashrate > 0) {
                networkHashrate = formatHashrate(coinData.hashrate).trim();
            }
            if (typeof coinData.workers === 'number') {
                poolWorkers = coinData.workers;
            }
        }

        // --- Parse miner balance ---
        // Kryptex balance API returns { immature, pending, paid } in full QUAI units
        let pendingBalance = '0.0000 QUAI';
        let totalPaid = '0.0000 QUAI';
        if (minerBalance) {
            const bal = minerBalance as { immature?: number; pending?: number; paid?: number; balance?: number };
            const pending = (bal.immature ?? 0) + (bal.pending ?? 0) + (bal.balance ?? 0);
            const paid = bal.paid ?? 0;
            if (pending > 0) pendingBalance = `${pending.toFixed(4)} QUAI`;
            if (paid > 0)    totalPaid      = `${paid.toFixed(4)} QUAI`;
        }

        // --- Parse miner workers ---
        let activeWorkers = 0;
        let minerHashrate: string | null = null;
        if (minerWorkers) {
            const w = minerWorkers as { workers?: Array<{ hashrate?: number; online?: boolean }> };
            if (Array.isArray(w.workers)) {
                activeWorkers = w.workers.filter((worker) => worker.online !== false).length;
                const totalMHs = w.workers.reduce((sum, worker) => sum + (worker.hashrate ?? 0), 0);
                if (totalMHs > 0) {
                    minerHashrate = formatHashrate(totalMHs).trim();
                }
            }
        }

        return NextResponse.json({
            networkHashrate,
            poolWorkers,
            totalPaid,
            pendingBalance,
            unpaidBalance: pendingBalance,
            payoutThreshold: '20.00 QUAI',
            activeWorkers,
            minerHashrate,
            blockHeight:   zoneBlock   || defaultResponse.blockHeight,
            chainHeights: {
                zone:   zoneBlock   || defaultResponse.chainHeights.zone,
                region: regionBlock || defaultResponse.chainHeights.region,
                prime:  primeBlock  || defaultResponse.chainHeights.prime,
            },
            transactions: []
        });

    } catch (_) {
        return NextResponse.json({
            ...defaultResponse,
            networkHashrate: 'Offline',
            poolWorkers: 0,
            offline: true
        });
    }
}
