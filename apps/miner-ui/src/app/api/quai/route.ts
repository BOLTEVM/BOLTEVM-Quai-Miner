import { NextResponse } from 'next/server';

const RPC_ENDPOINTS = [
    'https://rpc.cyprus1.colosseum.quaiscan.io',
    'https://rpc.quai.network/cyprus1',
    'https://cyprus1.rpc.quai.network'
];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    const defaultResponse = {
        networkHashrate: '185.0 GH/s',
        totalPaid: '0.0000 QUAI',
        unpaidBalance: '0.0000 QUAI',
        payoutThreshold: '10.00 QUAI',
        blockHeight: 1042500,
        transactions: []
    };

    if (!address || !address.trim() || address === 'undefined') {
        return NextResponse.json(defaultResponse);
    }

    const cleanAddress = address.trim();

    for (const rpcUrl of RPC_ENDPOINTS) {
        try {
            const [balanceRes, blockRes] = await Promise.all([
                fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'quai_getBalance',
                        params: [cleanAddress, 'latest'],
                        id: 1
                    }),
                    signal: AbortSignal.timeout(3000)
                }).catch(() => null),
                fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'quai_blockNumber',
                        params: [],
                        id: 2
                    }),
                    signal: AbortSignal.timeout(3000)
                }).catch(() => null)
            ]);

            if (!balanceRes || !balanceRes.ok) continue;

            const balanceData = await balanceRes.json();
            if (balanceData.error || balanceData.result === undefined) continue;

            const balanceWei = BigInt(balanceData.result || '0');
            const balanceQuai = (Number(balanceWei) / 1e18).toFixed(4);

            let blockHeight = 1042500;
            if (blockRes && blockRes.ok) {
                try {
                    const blockData = await blockRes.json();
                    if (blockData.result) {
                        blockHeight = parseInt(blockData.result, 16);
                    }
                } catch (e) {}
            }

            return NextResponse.json({
                networkHashrate: '185.0 GH/s',
                totalPaid: `${balanceQuai} QUAI`,
                unpaidBalance: '0.0000 QUAI',
                payoutThreshold: '10.00 QUAI',
                blockHeight,
                transactions: []
            });
        } catch (e) {
            // Fallback to next endpoint
        }
    }

    return NextResponse.json(defaultResponse);
}
