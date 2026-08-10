import { NextResponse } from 'next/server';

const RPC_ZONE = 'https://rpc.quai.network/cyprus1';
const RPC_REGION = 'https://rpc.quai.network/cyprus';
const RPC_PRIME = 'https://rpc.quai.network/prime';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    const defaultResponse = {
        networkHashrate: '185.0 GH/s',
        totalPaid: '0.0000 QUAI',
        unpaidBalance: '0.0000 QUAI',
        payoutThreshold: '10.00 QUAI',
        blockHeight: 9498168,
        chainHeights: { zone: 9498168, region: 5097653, prime: 2099398 },
        transactions: []
    };

    const cleanAddress = address && address.trim() !== 'undefined' ? address.trim() : '';

    try {
        const fetchBlock = async (url: string) => {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'quai_blockNumber', params: [], id: 1 }),
                    signal: AbortSignal.timeout(3000)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.result) return parseInt(data.result, 16);
                }
            } catch (e) {}
            return 0;
        };

        const [zoneBlock, regionBlock, primeBlock, balanceRes] = await Promise.all([
            fetchBlock(RPC_ZONE),
            fetchBlock(RPC_REGION),
            fetchBlock(RPC_PRIME),
            cleanAddress ? fetch(RPC_ZONE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'quai_getBalance', params: [cleanAddress, 'latest'], id: 1 }),
                signal: AbortSignal.timeout(3000)
            }).catch(() => null) : Promise.resolve(null)
        ]);

        let balanceQuai = '0.0000';
        if (balanceRes && balanceRes.ok) {
            const balanceData = await balanceRes.json();
            if (balanceData.result) {
                const balanceWei = BigInt(balanceData.result || '0');
                balanceQuai = (Number(balanceWei) / 1e18).toFixed(4);
            }
        }

        return NextResponse.json({
            networkHashrate: '185.0 GH/s',
            totalPaid: `${balanceQuai} QUAI`,
            unpaidBalance: '0.0000 QUAI',
            payoutThreshold: '10.00 QUAI',
            blockHeight: zoneBlock || defaultResponse.blockHeight,
            chainHeights: {
                zone: zoneBlock || defaultResponse.chainHeights.zone,
                region: regionBlock || defaultResponse.chainHeights.region,
                prime: primeBlock || defaultResponse.chainHeights.prime
            },
            transactions: []
        });
    } catch (e) {
        return NextResponse.json(defaultResponse);
    }
}
