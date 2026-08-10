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
        networkDifficulty: 1000000,
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
            const [balanceRes, blockRes, headerRes] = await Promise.all([
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
                }).catch(() => null),
                fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'quai_getHeaderByNumber',
                        params: ['latest'],
                        id: 3
                    }),
                    signal: AbortSignal.timeout(3000)
                }).catch(() => null)
            ]);

            if (!balanceRes || !balanceRes.ok) continue;

            const balanceData = await balanceRes.json();
            if (balanceData.error || balanceData.result === undefined) continue;

            const balanceWei = BigInt(balanceData.result || '0');
            const integerPart = balanceWei / 10n**18n;
            const fractionalPart = ((balanceWei % 10n**18n) / 10n**14n).toString().padStart(4, '0');
            const balanceQuai = `${integerPart}.${fractionalPart}`;

            let blockHeight = 1042500;
            if (blockRes && blockRes.ok) {
                try {
                    const blockData = await blockRes.json();
                    if (blockData.result) {
                        blockHeight = parseInt(blockData.result, 16);
                    }
                } catch (e) {}
            }

            let networkDifficulty = 1000000;
            if (headerRes && headerRes.ok) {
                try {
                    const headerData = await headerRes.json();
                    if (headerData.result?.difficulty) {
                        networkDifficulty = parseInt(headerData.result.difficulty, 16);
                    }
                } catch (e) {}
            }

            return NextResponse.json({
                networkHashrate: '185.0 GH/s',
                networkDifficulty,
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
