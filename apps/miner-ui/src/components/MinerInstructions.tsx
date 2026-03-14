'use client';

import { Terminal, Cpu, Database, Server, ExternalLink } from 'lucide-react';

export default function MinerInstructions() {
    return (
        <div className="instructions-container animate-fade-in">
            <div className="section-header">
                <Server size={20} color="var(--accent-cyan)" />
                <h3>Professional Miner Configuration (Recommended)</h3>
            </div>

            <div className="instructions-grid">
                <div className="glass-card instruction-card">
                    <div className="card-top">
                        <Cpu size={24} />
                        <div>
                            <h4>1. Build Quai GPU Miner</h4>
                            <p>Clone and build optimized ProgPoW miner.</p>
                        </div>
                    </div>
                    <div className="code-block">
                        <code>cmake --build . --config Release</code>
                    </div>
                </div>

                <div className="glass-card instruction-card">
                    <div className="card-top">
                        <Database size={24} />
                        <div>
                            <h4>2. Run Stratum Proxy</h4>
                            <p>Interface between GPU and Quai Shards.</p>
                        </div>
                    </div>
                    <p className="description">Sets the target shard and handles payout addresses for Prime, Region, and Zone chains.</p>
                </div>

                <div className="glass-card instruction-card full-width">
                    <div className="card-top">
                        <Terminal size={24} />
                        <div>
                            <h4>3. Execute Mining Command</h4>
                            <p>Direct the miner to your proxy address.</p>
                        </div>
                    </div>
                    <div className="code-block highlighted">
                        <code>./quai-gpu-miner -U -S localhost:3333 -W worker1 --account 0x004d...d906</code>
                    </div>
                    <div className="tech-notes">
                        <span><strong>-U</strong> NVIDIA (CUDA)</span>
                        <span><strong>-G</strong> AMD (OpenCL)</span>
                        <span className="payout-note">Payouts sent to: 0x004d...d906</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .instructions-container {
          margin-top: 32px;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .section-header h3 {
          font-size: 18px;
          color: var(--text-primary);
        }
        .instructions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .instruction-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .instruction-card.full-width {
          grid-column: span 2;
        }
        .card-top {
          display: flex;
          gap: 16px;
          align-items: center;
          color: var(--accent-cyan);
        }
        .card-top h4 {
          margin: 0;
          color: var(--text-primary);
        }
        .card-top p {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .description {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .code-block {
          background: rgba(0, 0, 0, 0.4);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #eee;
        }
        .highlighted {
          border-color: rgba(0, 242, 255, 0.3);
          box-shadow: 0 0 15px rgba(0, 242, 255, 0.05);
        }
        .tech-notes {
          display: flex;
          gap: 20px;
          font-size: 12px;
          color: var(--text-secondary);
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .tech-notes strong {
          color: var(--accent-cyan);
        }
        .payout-note {
           margin-left: auto;
           color: var(--accent-purple);
           font-weight: 600;
        }
        @media (max-width: 768px) {
          .instructions-grid { grid-template-columns: 1fr; }
          .instruction-card.full-width { grid-column: span 1; }
        }
      `}</style>
        </div>
    );
}
