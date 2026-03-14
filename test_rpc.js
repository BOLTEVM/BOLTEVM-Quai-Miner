const fetch = require('node-fetch');

async function testBalance() {
    const rpcUrl = 'https://rpc.quai.network/cyprus1';
    const address = '0x004d3530737b741025A7875eAA7A7D1E5a54d906';

    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'quai_getBalance',
                params: [address, 'latest'],
                id: 1,
            }),
        });
        const data = await response.json();
        console.log('Result:', data);
        if (data.result) {
            const attoQuai = BigInt(data.result);
            const quai = Number(attoQuai) / 1e18;
            console.log(`Balance: ${quai} QUAI`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testBalance();
