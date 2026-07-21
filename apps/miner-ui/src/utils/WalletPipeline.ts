import { TheGuardsWalletPipeline, WalletTxRequest, WalletTxResult } from '../../../../../theguards';

export interface QuaiTxRequest extends WalletTxRequest {
    quaiShard?: 'Cyprus' | 'Paxos' | 'Hydra';
    payoutAddress?: string;
}

/**
 * Quai Network Wallet Pipeline
 * Native Web3 transaction execution pipeline for bquai Quai Network mining stack folder.
 * Handles Quai shard multi-chain transactions via The Guards Scaffolding (WG-01..04).
 */
export class QuaiWalletPipeline {
    /**
     * Executes a Quai Network transaction and AWAITS on-chain block receipt verification.
     */
    public static async executeAndAwaitTransaction(
        req: QuaiTxRequest
    ): Promise<WalletTxResult> {
        console.log(`[QuaiWalletPipeline] Executing transaction on Shard [${req.quaiShard || 'Cyprus'}] to ${req.to}...`);

        return TheGuardsWalletPipeline.executeAndAwaitTransaction({
            to: req.to,
            from: req.from,
            data: req.data,
            value: req.value,
            gasLimit: req.gasLimit,
            chainId: req.chainId || 9000, // Quai Network Chain ID
            rpcUrl: req.rpcUrl || 'http://127.0.0.1:8001',
            provider: req.provider,
            confirmations: req.confirmations,
            timeoutMs: req.timeoutMs
        });
    }

    public static async ensureChain(provider: any, chainId: number, rpcUrl: string) {
        return TheGuardsWalletPipeline.ensureChain(provider, chainId, rpcUrl);
    }
}
