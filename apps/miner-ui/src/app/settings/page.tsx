'use client';

import Sidebar from '../../components/Sidebar'
import { Save, Shield, Globe, Cpu } from 'lucide-react'

export default function SettingsPage() {
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
                            <input type="text" defaultValue="stratum+tcp://quai.pool.bolt-evm.com:3333" />
                        </div>
                        <div className="form-group">
                            <label>Fallback Pool</label>
                            <input type="text" defaultValue="stratum+tcp://quai.backup-pool.com:4444" />
                        </div>
                    </div>

                    <div className="glass-card settings-section">
                        <div className="section-header">
                            <Shield size={20} color="var(--accent-cyan)" />
                            <h3>Wallet & Security</h3>
                        </div>
                        <div className="form-group">
                            <label>Quai Wallet Address</label>
                            <input type="text" defaultValue="0x71C7656EC7ab88b098defB751B7401B5f6d8976F" />
                        </div>
                    </div>

                    <div className="glass-card settings-section">
                        <div className="section-header">
                            <Cpu size={20} color="var(--accent-cyan)" />
                            <h3>Performance</h3>
                        </div>
                        <div className="form-group checkbox">
                            <input type="checkbox" defaultChecked />
                            <label>Auto-adjust difficulty (VARDIFF)</label>
                        </div>
                        <div className="form-group">
                            <label>Mining Intensity</label>
                            <select>
                                <option>Low (Power Saving)</option>
                                <option selected>Medium (Standard)</option>
                                <option>High (Max Performance)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button className="btn-primary flex-items save-btn">
                    <Save size={20} />
                    <span>Save Configuration</span>
                </button>
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
        .save-btn { align-self: flex-start; }
        .flex-items { display: flex; align-items: center; gap: 8px; }
      `}</style>
        </div>
    )
}
