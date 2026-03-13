'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar'
import { Save, Shield, Globe, Cpu, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
    const [config, setConfig] = useState({
        stratum: 'stratum+tcp://quai.pool.bolt-evm.com:3333',
        fallback: 'stratum+tcp://quai.backup-pool.com:4444',
        wallet: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        intensity: 'Medium (Standard)',
        autoDiff: true
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('miner_state');
        if (stored) {
            const state = JSON.parse(stored);
            setConfig(prev => ({
                ...prev,
                wallet: state.wallet || prev.wallet,
                autoDiff: state.autoDiff !== undefined ? state.autoDiff : prev.autoDiff,
                intensity: state.intensity || prev.intensity,
                stratum: state.stratum || prev.stratum,
                fallback: state.fallback || prev.fallback
            }));
        }
    }, []);

    const handleSave = () => {
        const stored = localStorage.getItem('miner_state');
        let state = stored ? JSON.parse(stored) : {};

        const newState = {
            ...state,
            wallet: config.wallet,
            intensity: config.intensity,
            autoDiff: config.autoDiff,
            stratum: config.stratum,
            fallback: config.fallback
        };

        localStorage.setItem('miner_state', JSON.stringify(newState));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="page-container">
            <Sidebar />
            <main className="main-content">
                <header className="page-header">
                    <h1>Miner Configuration</h1>
                    <p>Configure your pool, wallet, and performance settings.</p>
                </header>

                <div className="settings-grid">
                    <div className="glass-card settings-section">
                        <div className="section-header">
                            <Globe size={20} color="var(--accent-cyan)" />
                            <h3>Pool Configuration</h3>
                        </div>
                        <div className="form-group">
                            <label>Stratum URL</label>
                            <input
                                type="text"
                                value={config.stratum}
                                onChange={(e) => setConfig({ ...config, stratum: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Fallback Pool</label>
                            <input
                                type="text"
                                value={config.fallback}
                                onChange={(e) => setConfig({ ...config, fallback: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="glass-card settings-section">
                        <div className="section-header">
                            <Shield size={20} color="var(--accent-cyan)" />
                            <h3>Wallet & Security</h3>
                        </div>
                        <div className="form-group">
                            <label>Quai Wallet Address</label>
                            <input
                                type="text"
                                value={config.wallet}
                                onChange={(e) => setConfig({ ...config, wallet: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="glass-card settings-section">
                        <div className="section-header">
                            <Cpu size={20} color="var(--accent-cyan)" />
                            <h3>Performance</h3>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                checked={config.autoDiff}
                                onChange={(e) => setConfig({ ...config, autoDiff: e.target.checked })}
                            />
                            <label>Auto-adjust difficulty (VARDIFF)</label>
                        </div>
                        <div className="form-group">
                            <label>Mining Intensity</label>
                            <select
                                value={config.intensity}
                                onChange={(e) => setConfig({ ...config, intensity: e.target.value })}
                            >
                                <option value="Low (Power Saving)">Low (Power Saving)</option>
                                <option value="Medium (Standard)">Medium (Standard)</option>
                                <option value="High (Max Performance)">High (Max Performance)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="footer-actions">
                    <button className="btn-primary flex-items save-btn" onClick={handleSave}>
                        <Save size={20} />
                        <span>{saved ? 'Configuration Saved' : 'Save Configuration'}</span>
                    </button>
                    {saved && <div className="save-toast animate-fade-in"><CheckCircle size={16} /> Updated successfully</div>}
                </div>
            </main>

            <style jsx>{`
        .page-container { display: flex; min-height: 100vh; }
        .main-content { flex: 1; padding: 48px; display: flex; flex-direction: column; gap: 32px; }
        .settings-grid { display: grid; grid-template-columns: 1fr; gap: 24px; max-width: 800px; }
        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .form-group.checkbox { flex-direction: row; align-items: center; gap: 12px; }
        .form-group label { font-size: 14px; color: var(--text-secondary); }
        input[type="text"], select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          padding: 12px;
          border-radius: 8px;
          color: white;
          outline: none;
        }
        input[type="text"]:focus { border-color: var(--accent-cyan); }
        .footer-actions { display: flex; align-items: center; gap: 20px; }
        .save-btn { min-width: 200px; }
        .save-toast { color: #00ff7f; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .flex-items { display: flex; align-items: center; gap: 8px; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
        </div>
    )
}
