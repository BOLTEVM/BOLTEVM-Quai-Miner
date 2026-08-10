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
        totalPaid: '0.0000 QUAI'
    };

    if (!address || !address.trim() || address === 'undefined') {
        return NextResponse.json(defaultResponse);
    }

    const cleanAddress = address.trim();

    for (const rpcUrl of RPC_ENDPOINTS) {
        try {
            const res = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'quai_getBalance',
                    params: [cleanAddress, 'latest'],
                    id: 1
                }),
                signal: AbortSignal.timeout(3000)
            });

            if (!res.ok) continue;

            const data = await res.json();
            if (data.error || data.result === undefined) continue;

            const balanceWei = BigInt(data.result || '0');
            const balanceQuai = (Number(balanceWei) / 1e18).toFixed(4);

            return NextResponse.json({
                networkHashrate: '185.0 GH/s',
                totalPaid: `${balanceQuai} QUAI`
            });
        } catch (e) {
            // Fallback to next endpoint in RPC_ENDPOINTS
        }
    }

    return NextResponse.json(defaultResponse);
}
