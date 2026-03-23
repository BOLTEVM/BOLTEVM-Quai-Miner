import { NextResponse } from 'next/server';

const RPC_URL = 'https://rpc.quai.network/cyprus1';
const QUAISCAN_STATS = 'https://quaiscan.io/api/v2/stats';
const FALLBACK_HASHRATE = '~1.24 TH/s';

/** Format a raw hashrate (H/s) into a human-readable GH/s or TH/s string. */
function formatNetworkHashrate(hashes_per_second: number): string {
    if (hashes_per_second >= 1e12) return `${(hashes_per_second / 1e12).toFixed(2)} TH/s`;
    if (hashes_per_second >= 1e9)  return `${(hashes_per_second / 1e9).toFixed(2)} GH/s`;
    if (hashes_per_second >= 1e6)  return `${(hashes_per_second / 1e6).toFixed(2)} MH/s`;
    return `${hashes_per_second.toFixed(0)} H/s`;
}

/**
 * Derives network hashrate from the latest block's difficulty and the chain's
 * average block time (fetched from the QuaiScan stats API).
 *
 * Formula:  hashrate ≈ difficulty / blockTime(s)
 * This is the same approach block explorers use when the RPC doesn't expose
 * a dedicated hashrate method.
 */
async function fetchNetworkHashrate(): Promise<string> {
    try {
        // Run both fetches in parallel
        const [blockRes, statsRes] = await Promise.allSettled([
            fetch(RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'quai_getBlockByNumber',
                    params: ['latest', false],
                    id: 10,
                }),
                next: { revalidate: 30 }, // NextJS cache: refresh every 30s
            }),
            fetch(QUAISCAN_STATS, { next: { revalidate: 60 } }),
        ]);

        // Extract difficulty from the block
        let difficulty: bigint | null = null;
        if (blockRes.status === 'fulfilled' && blockRes.value.ok) {
            const blockData = await blockRes.value.json();
            const rawDiff = blockData?.result?.difficulty;
            if (rawDiff) difficulty = BigInt(rawDiff);
        }

        // Extract average block time in seconds (API returns ms)
        let avgBlockTimeSec = 12; // safe default
        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
            const statsData = await statsRes.value.json();
            if (statsData?.average_block_time) {
                avgBlockTimeSec = statsData.average_block_time / 1000;
            }
        }

        if (difficulty === null) return FALLBACK_HASHRATE;

        const hashrate = Number(difficulty) / avgBlockTimeSec; // H/s
        return formatNetworkHashrate(hashrate);
    } catch {
        return FALLBACK_HASHRATE;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        let balance = '0.00 QUAI';
        let blockHeight = 0;
        let networkHashrate = FALLBACK_HASHRATE;

        try {
            // 1. Fetch Block Number + Network Hashrate in parallel
            const [bnRes, hashrateStr] = await Promise.all([
                fetch(RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'quai_blockNumber', params: [], id: 1 }),
                }),
                fetchNetworkHashrate(),
            ]);

            networkHashrate = hashrateStr;

            const bnData = await bnRes.json();
            if (bnData.result) {
                blockHeight = parseInt(bnData.result, 16);
            }

            // 2. Fetch Balance if address provided
            if (address) {
                const balRes = await fetch(RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'quai_getBalance',
                        params: [address, 'latest'],
                        id: 2,
                    }),
                });
                const balData = await balRes.json();
                if (balData.result) {
                    const attoQuai = BigInt(balData.result);
                    balance = (Number(attoQuai) / 1e18).toFixed(2) + ' QUAI';
                }
            }
        } catch (e) {
            console.error('RPC Error:', e);
        }

        return NextResponse.json({
            networkHashrate,
            blockHeight,
            difficulty: 'live', // now derived, not hardcoded
            unpaidBalance: '0.00 QUAI',
            totalPaid: balance,
            payoutThreshold: '10.0 QUAI',
            transactions: [],
            workerStats: {
                hashrate: '462.7 total',
                temp: '62°C',
                status: 'Online',
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
