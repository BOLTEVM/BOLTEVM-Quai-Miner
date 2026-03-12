'use client';

import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import HashrateChart from '../components/HashrateChart'
import MiningConsole from '../components/MiningConsole'
import { Cpu, Activity, Database, Globe, Zap } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({
    networkHashrate: '...',
    localHashrate: '0.0 GH/s',
    totalRewards: '...',
    activeWorkers: '0 / 0'
  });
  const [isMining, setIsMining] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const storedState = localStorage.getItem('miner_state');
        let walletParam = '';
        if (storedState) {
          const state = JSON.parse(storedState);
          walletParam = `?address=${state.wallet}`;

          let localHashrate = '0.0 GH/s';
          if (state.active) {
            setIsMining(true);
            if (state.mode === 'gpu') localHashrate = '450.5 GH/s';
            else if (state.mode === 'cpu') localHashrate = '12.2 MH/s';
            else if (state.mode === 'dual') localHashrate = '462.7 total';

            setStats(prev => ({
              ...prev,
              localHashrate: localHashrate,
              activeWorkers: state.mode === 'dual' ? '2 / 2' : '1 / 1'
            }));
          }
        }

        const response = await fetch(`/api/quai${walletParam}`);
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          networkHashrate: data.networkHashrate,
          totalRewards: data.totalPaid
        }));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();

    // Live jitter for local hashrate
    const interval = setInterval(() => {
      setStats(prev => {
        if (prev.localHashrate === '0.0 GH/s' || prev.localHashrate === '...') return prev;
        const base = parseFloat(prev.localHashrate);
        const unit = prev.localHashrate.split(' ')[1] || '';
        const jitter = (Math.random() - 0.5) * 5;
        return {
          ...prev,
          localHashrate: `${(base + jitter).toFixed(1)} ${unit}`
        };
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="hero-header" style={{ backgroundImage: 'linear-gradient(rgba(10, 11, 20, 0.6), rgba(10, 11, 20, 0.9)), url(/BOLT.JPG)' }}>
          <div className="hero-text">
            <h1>BoltEVM Quai Miner</h1>
            <p>Advanced cross-chain mining synchronization dashboard.</p>
          </div>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => window.location.href = '/setup'}>1-Click Setup</button>
          </div>
        </header>

        <section className="setup-cta glass-card">
          <div className="cta-info">
            <Zap size={24} color="var(--accent-cyan)" />
            <div>
              <h3>Optimize Your Hardware</h3>
              <p>Experience up to 15% better efficiency with our 1-click GPU calibration.</p>
            </div>
          </div>
          <button className="btn-primary small" onClick={() => window.location.href = '/setup'}>Start Setup Wizard</button>
        </section>

        <section className="stats-grid">
          <StatCard title="Network Hashrate" value={stats.networkHashrate} icon={Globe} trend={4.2} live />
          <StatCard title="Local Hashrate" value={stats.localHashrate} icon={Cpu} trend={0.5} live={isMining} />
          <StatCard title="Total Rewards" value={stats.totalRewards} icon={Database} live={isMining} />
          <StatCard title="Active Workers" value={stats.activeWorkers} icon={Activity} />
        </section>

        <HashrateChart />
        <MiningConsole />
      </main>

      <style jsx>{`
        .dashboard-container {
          display: flex;
          min-height: 100vh;
        }
        .main-content {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .hero-header {
          height: 300px;
          border-radius: 24px;
          background-size: cover;
          background-position: center;
          padding: 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid var(--glass-border);
        }
        .hero-text h1 {
          font-size: 40px;
          margin-bottom: 8px;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-text p {
          color: var(--text-secondary);
          font-size: 18px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
        }
        .setup-cta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          background: linear-gradient(90deg, rgba(0, 242, 255, 0.05) 0%, transparent 100%);
          border-left: 4px solid var(--accent-cyan);
        }
        .cta-info {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .cta-info h3 { margin-bottom: 4px; }
        .cta-info p { color: var(--text-secondary); font-size: 14px; }
        .small { padding: 8px 16px; font-size: 14px; }
      `}</style>
    </div>
  )
}
