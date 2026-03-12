'use client';

import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import { Wallet, ArrowDownRight, Zap } from 'lucide-react'

export default function RewardsPage() {
    const [rewardsData, setRewardsData] = useState<any>(null);
    const [wallet, setWallet] = useState<string | null>(null);

    useEffect(() => {
        const storedState = localStorage.getItem('miner_state');
        if (storedState) {
            const state = JSON.parse(storedState);
            setWallet(state.wallet);

            const fetchData = async () => {
                try {
                    const response = await fetch(`/api/quai?address=${state.wallet}`);
                    const data = await response.json();
                    setRewardsData(data);
                } catch (e) {
                    console.error('Failed to fetch rewards:', e);
                }
            };
            fetchData();
        }
    }, []);

    if (!rewardsData) {
        return (
            <div className="page-container">
                <Sidebar />
                <main className="main-content">
                    <header className="page-header">
                        <h1>Rewards & Payouts</h1>
                        <p>Loading your earning history...</p>
                    </header>
                </main>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <main className="main-content">
                <header className="page-header">
                    <h1>Rewards & Payouts</h1>
                    <p>Track your mining earnings for <span className="wallet-span">{wallet}</span></p>
                </header>

                <section className="rewards-summary">
                    <div className="glass-card summary-item">
                        <span className="label">Unpaid Balance</span>
                        <h2>{rewardsData.unpaidBalance}</h2>
                        <button className="btn-primary small">Withdraw</button>
                    </div>
                    <div className="glass-card summary-item">
                        <span className="label">Total Paid</span>
                        <h2>{rewardsData.totalPaid}</h2>
                    </div>
                    <div className="glass-card summary-item">
                        <span className="label">Next Payout</span>
                        <h2>~ {rewardsData.payoutThreshold} (Estimated)</h2>
                    </div>
                </section>

                <div className="glass-card">
                    <h3>Transaction History</h3>
                    <ul className="reward-list">
                        {rewardsData.transactions.map((r: any) => (
                            <li key={r.id}>
                                <div className="reward-icon"><ArrowDownRight size={18} /></div>
                                <div className="reward-info">
                                    <span className="reward-type">{r.type}</span>
                                    <span className="reward-date">{r.date}</span>
                                </div>
                                <div className="reward-amount">{r.amount}</div>
                                <div className="reward-status">{r.status}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </main>

            <style jsx>{`
        .page-container { display: flex; min-height: 100vh; }
        .main-content { flex: 1; padding: 48px; display: flex; flex-direction: column; gap: 32px; }
        .rewards-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .summary-item { display: flex; flex-direction: column; gap: 8px; }
        .label { color: var(--text-secondary); font-size: 14px; }
        .small { padding: 8px 16px; font-size: 14px; margin-top: 12px; align-self: flex-start; }
        .reward-list { list-style: none; margin-top: 24px; }
        .reward-list li {
          display: grid;
          grid-template-columns: 40px 1fr 150px 100px;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--glass-border);
        }
        .reward-icon {
          width: 32px;
          height: 32px;
          background: rgba(0, 242, 255, 0.1);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-cyan);
        }
        .reward-info { display: flex; flex-direction: column; }
        .reward-type { font-weight: 600; }
        .reward-date { font-size: 12px; color: var(--text-secondary); }
        .reward-amount { font-weight: 700; color: var(--accent-cyan); }
        .reward-status { font-size: 12px; color: #00ff7f; font-weight: 600; }
        .wallet-span { color: var(--accent-cyan); font-family: monospace; font-size: 14px; }
      `}</style>
        </div>
    )
}
