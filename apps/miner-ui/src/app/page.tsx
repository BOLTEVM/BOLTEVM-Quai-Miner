'use client';

import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import HashrateChart from '../components/HashrateChart'
import MiningConsole from '../components/MiningConsole'
import { Cpu, Activity, Database, Globe, Zap } from 'lucide-react'
import { estimateHashrate, convertToStandardUnit } from '../utils/hashrate'

export default function Dashboard() {
  const [stats, setStats] = useState({
    networkHashrate: '...',
    localHashrate: '0.0 GH/s',
    totalRewards: '0.00 QUAI',
    activeWorkers: '0 / 0'
  });
  const [sessionRewards, setSessionRewards] = useState(0);
  const [isMining, setIsMining] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const storedState = localStorage.getItem('miner_state');
        let walletAddress = '';
        if (storedState) {
          const state = JSON.parse(storedState);
          walletAddress = state.wallet;

          if (state.active) {
            setIsMining(true);
            let totalMh = 0;
            let workerCount = 0;

            if (state.mode === 'gpu' || state.mode === 'dual') {
              state.gpus.forEach((gpu: string) => {
                const est = estimateHashrate(gpu, 'gpu');
                totalMh += convertToStandardUnit(est.value, est.unit);
                workerCount++;
              });
            }

            if (state.mode === 'cpu' || state.mode === 'dual') {
              const cpuName = state.cpu?.name || 'Generic CPU';
              const est = estimateHashrate(cpuName, 'cpu');
              totalMh += convertToStandardUnit(est.value, est.unit);
              workerCount++;
            }

            const totalGh = totalMh / 1000;

            setStats(prev => ({
              ...prev,
              localHashrate: totalGh > 1 ? `${totalGh.toFixed(1)} GH/s` : `${totalMh.toFixed(1)} MH/s`,
              activeWorkers: `${workerCount} / ${workerCount}`
            }));
          }
        }

        const response = await fetch(`/api/quai?address=${walletAddress}`);
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          networkHashrate: data.networkHashrate,
          totalRewards: data.totalPaid || '0.00 QUAI'
        }));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();

    // Refresh stats every 30s for real data
    const refreshInterval = setInterval(fetchStats, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const handleBlockFound = () => {
    // Standard Quai Cyprus-1 block reward estimation
    setSessionRewards(prev => prev + 2.5);
  };

  const [measuredHashrate, setMeasuredHashrate] = useState<string | null>(null);

  // Handle hashrate updates from worker
  const handleHashrateUpdate = (mh: number) => {
    const gh = mh / 1000;
    setMeasuredHashrate(gh > 1 ? `${gh.toFixed(1)} GH/s` : `${mh.toFixed(1)} MH/s`);
  };

  // Combined rewards (Confirmed + Session)
  const confirmedRewards = parseFloat(stats.totalRewards.split(' ')[0]) || 0;
  const totalCombined = (confirmedRewards + sessionRewards).toFixed(2);

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
          <StatCard
            title="Local Hashrate"
            value={isMining && measuredHashrate ? measuredHashrate : stats.localHashrate}
            subValue={isMining && measuredHashrate ? 'MEASURED (LIVE)' : 'ESTIMATED'}
            icon={Cpu}
            trend={0.5}
            live={isMining}
          />
          <StatCard
            title="Total Rewards"
            value={stats.totalRewards}
            subValue={`+ ${sessionRewards.toFixed(2)} Session Est.`}
            icon={Database}
            live={isMining}
            trend={sessionRewards > 0 ? (sessionRewards / confirmedRewards * 100) : undefined}
            onClick={() => {
              const stored = localStorage.getItem('miner_state');
              if (stored) {
                const state = JSON.parse(stored);
                window.open(`https://explorer.quai.network/address/${state.wallet}`, '_blank');
              }
            }}
          />
          <StatCard title="Active Workers" value={stats.activeWorkers} icon={Activity} />
        </section>

        <HashrateChart />
        <MiningConsole onBlockFound={handleBlockFound} onHashrateUpdate={handleHashrateUpdate} />
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
