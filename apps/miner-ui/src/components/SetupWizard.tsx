'use client';

import { useState, useEffect } from 'react';
import { Cpu, CheckCircle, Rocket, ShieldCheck, Zap, Database, Terminal, Loader2 } from 'lucide-react';

const steps = [
    { id: 1, title: 'Hardware Detection', icon: Cpu },
    { id: 2, title: 'Mining Profile', icon: Zap },
    { id: 3, title: 'Optimized Build', icon: Terminal },
    { id: 4, title: 'Network Sync', icon: ShieldCheck },
    { id: 5, title: 'Rewards', icon: Database },
    { id: 6, title: 'Launch', icon: Rocket },
];

export default function SetupWizard() {
    const [currentStep, setCurrentStep] = useState(1);
    const [detecting, setDetecting] = useState(false);
    const [gpus, setGpus] = useState<string[]>([]);
    const [cpu, setCpu] = useState<{ name: string; cores: number; threads: number } | null>(null);
    const [miningMode, setMiningMode] = useState<'gpu' | 'cpu' | 'dual'>('gpu');
    const [profile, setProfile] = useState('balanced');
    const [wallet, setWallet] = useState('');
    const [syncProgress, setSyncProgress] = useState(0);
    const [buildLogs, setBuildLogs] = useState<string[]>([]);
    const [isBuilding, setIsBuilding] = useState(false);
    const [buildSuccess, setBuildSuccess] = useState(false);
    const [depsOk, setDepsOk] = useState<boolean | null>(null);
    const [isCheckingDeps, setIsCheckingDeps] = useState(false);
    const [deps, setDeps] = useState<Array<{ name: string; required: boolean; ok: boolean; version: string | null; hint: string }>>([]);
    const [isRepairing, setIsRepairing] = useState(false);

    // Auto-run dep check when user arrives at Step 3
    useEffect(() => {
        if (currentStep === 3 && depsOk === null && !isCheckingDeps) {
            checkDependencies();
        }
    }, [currentStep]);

    useEffect(() => {
        if (currentStep === 4) {
            const timer = setInterval(() => {
                setSyncProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(timer);
                        return 100;
                    }
                    return prev + Math.floor(Math.random() * 5) + 2;
                });
            }, 150);
            return () => clearInterval(timer);
        }
    }, [currentStep]);

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const simulateDetection = async () => {
        setDetecting(true);
        try {
            const response = await fetch('/api/hardware');
            const data = await response.json();
            if (data.gpus) setGpus(data.gpus);
            if (data.cpu) setCpu(data.cpu);

            if (!data.gpus?.length && !data.cpu) {
                setGpus(['Standard Device (Detection Failed)']);
            }
        } catch (error) {
            console.error('Detection error:', error);
            setGpus(['Generic GPU (Manual Override)']);
        } finally {
            setDetecting(false);
        }
    };

    const checkDependencies = async () => {
        setIsCheckingDeps(true);
        setDepsOk(null);
        try {
            const response = await fetch('/api/check-deps');
            const data = await response.json();
            setDeps(data.deps ?? []);
            setDepsOk(data.ok ?? false);
        } catch (e) {
            setDepsOk(false);
            setDeps([]);
        } finally {
            setIsCheckingDeps(false);
        }
    };

    const repairEnvironment = async () => {
        setIsRepairing(true);
        setBuildLogs(['Starting environment repair...']);
        try {
            const response = await fetch('/api/miner/setup-env', { method: 'POST' });
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('Failed to start repair stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(l => l.trim());
                setBuildLogs(prev => [...prev, ...lines].slice(-100));

                if (text.includes('[SUCCESS]')) setDepsOk(true);
            }
        } catch (error: any) {
            setBuildLogs(prev => [...prev, `[FATAL] ${error.message}`]);
        } finally {
            setIsRepairing(false);
        }
    };

    const startBuild = async () => {
        setIsBuilding(true);
        setBuildLogs(['Initializing build sequence...']);
        try {
            const response = await fetch('/api/miner/build', { method: 'POST' });
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('Failed to start build stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(l => l.trim());
                setBuildLogs(prev => [...prev, ...lines].slice(-100)); // Keep last 100 lines

                if (text.includes('[SUCCESS]')) setBuildSuccess(true);
            }
        } catch (error: any) {
            setBuildLogs(prev => [...prev, `[FATAL] ${error.message}`]);
        } finally {
            setIsBuilding(false);
        }
    };

    return (
        <div className="wizard-container">
            <div className="stepper">
                {steps.map((step) => (
                    <div key={step.id} className={`step-item ${currentStep >= step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}>
                        <div className="step-icon">
                            {currentStep > step.id ? <CheckCircle size={20} /> : <step.icon size={20} />}
                        </div>
                        <span className="step-title">{step.title}</span>
                    </div>
                ))}
            </div>

            <div className="glass-card wizard-content">
                {currentStep === 1 && (
                    <div className="step-pane animate-in">
                        <h2>Hardware Detection</h2>
                        <p>Scanning your system for compatible CPU and GPU hardware...</p>

                        <div className="detection-box">
                            {detecting ? (
                                <div className="scanning">
                                    <div className="scanner-line"></div>
                                    <span>Scanning System Bus...</span>
                                </div>
                            ) : (gpus.length > 0 || cpu) ? (
                                <div className="detected-hardware">
                                    <div className="hardware-section">
                                        <h4>Detected GPUs</h4>
                                        <div className="gpu-list">
                                            {gpus.map((gpu, i) => (
                                                <div key={i} className="gpu-item">
                                                    <Cpu size={18} color="var(--accent-cyan)" />
                                                    <span>{gpu}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {cpu && (
                                        <div className="hardware-section">
                                            <h4>Detected CPU</h4>
                                            <div className="gpu-item">
                                                <Cpu size={18} color="var(--accent-purple)" />
                                                <span>{cpu.name} ({cpu.cores} Cores / {cpu.threads} Threads)</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="status-success">Hardware Profile Established</div>
                                </div>
                            ) : (
                                <button className="btn-primary" onClick={simulateDetection}>Detect Hardware</button>
                            )}
                        </div>

                        {(gpus.length > 0 || cpu) && !detecting && (
                            <div className="mode-selection">
                                <h3>Select Mining Strategy</h3>
                                <div className="profile-grid">
                                    <div className={`profile-card ${miningMode === 'gpu' ? 'selected' : ''}`} onClick={() => setMiningMode('gpu')}>
                                        <h3>GPU Only</h3>
                                        <p>Standard high-performance mining.</p>
                                    </div>
                                    <div className={`profile-card ${miningMode === 'cpu' ? 'selected' : ''}`} onClick={() => setMiningMode('cpu')}>
                                        <h3>CPU Only</h3>
                                        <p>Efficiency-first mining using quai-cpu-miner.</p>
                                    </div>
                                    <div className={`profile-card ${miningMode === 'dual' ? 'selected' : ''}`} onClick={() => setMiningMode('dual')}>
                                        <h3>Dual Mode</h3>
                                        <p>Maximize output using both CPU & GPU.</p>
                                    </div>
                                </div>
                                <button className="btn-primary" onClick={nextStep} style={{ width: '100%', marginTop: '20px' }}>Continue to Optimization</button>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-pane animate-in">
                        <h2>Select Mining Profile</h2>
                        <p>Choose an optimization set based on your requirements.</p>

                        <div className="profile-grid">
                            <div className={`profile-card ${profile === 'eco' ? 'selected' : ''}`} onClick={() => setProfile('eco')}>
                                <Zap size={24} />
                                <h3>Efficiency</h3>
                                <p>Reduced power draw, optimized for thermal longevity.</p>
                            </div>
                            <div className={`profile-card ${profile === 'balanced' ? 'selected' : ''}`} onClick={() => setProfile('balanced')}>
                                <Zap size={24} />
                                <h3>Balanced</h3>
                                <p>Maximum stability and standard hash/watt ratio.</p>
                            </div>
                            <div className={`profile-card ${profile === 'pro' ? 'selected' : ''}`} onClick={() => setProfile('pro')}>
                                <Zap size={24} />
                                <h3>Extreme</h3>
                                <p>Unlocked power limits for maximum output.</p>
                            </div>
                        </div>

                        <div className="actions">
                            <button className="btn-ghost" onClick={prevStep}>Back</button>
                            <button className="btn-primary" onClick={nextStep}>Apply & Sync</button>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-pane animate-in">
                        <h2>Build Optimized Binary</h2>
                        <p>Compiling official quai-gpu-miner from source for your specific hardware.</p>

                        {/* Dependency Pre-flight Panel */}
                        <div className="deps-panel glass-card">
                            <div className="deps-header">
                                <span>Build Environment Check</span>
                                <button
                                    className="btn-recheck"
                                    onClick={checkDependencies}
                                    disabled={isCheckingDeps}
                                >
                                    {isCheckingDeps ? <Loader2 size={12} className="animate-spin" /> : '↻'} Re-check
                                </button>
                            </div>

                            {isCheckingDeps && deps.length === 0 ? (
                                <div className="deps-scanning">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Scanning environment...</span>
                                </div>
                            ) : deps.length > 0 ? (
                                <div className="deps-list">
                                    {deps.map(dep => (
                                        <div key={dep.name} className={`dep-row ${dep.ok ? 'ok' : dep.required ? 'missing' : 'warn'}`}>
                                            <span className="dep-icon">{dep.ok ? '✅' : dep.required ? '❌' : '⚠️'}</span>
                                            <div className="dep-info">
                                                <span className="dep-name">{dep.name}</span>
                                                {dep.version && <span className="dep-version">{dep.version}</span>}
                                                {!dep.ok && <span className="dep-hint">{dep.hint}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : depsOk === null ? (
                                <div className="deps-scanning"><span>Click Re-check to probe your environment.</span></div>
                            ) : null}
                        </div>

                        <div className="build-terminal glass-card">
                            <div className="terminal-header">
                                <Terminal size={14} />
                                <span>{isRepairing ? 'Repairing Environment' : 'Build Output'}</span>
                                {(isBuilding || isRepairing) && <Loader2 size={14} className="animate-spin" />}
                            </div>
                            <div className="terminal-body" id="build-logs">
                                {buildLogs.length === 0 ? (
                                    <div className="empty-terminal">
                                        {depsOk === false ? 'Missing dependencies detected. Use Auto-Repair or install manually.' : 'Ready to compile official miner source.'}
                                    </div>
                                ) : (
                                    buildLogs.map((log, i) => (
                                        <div key={i} className={`log-line ${log.includes('[ERR]') || log.includes('[FAIL]') || log.includes('[FATAL]') ? 'err' : log.includes('[SUCCESS]') ? 'success' : ''}`}>
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="actions">
                            <button className="btn-ghost" onClick={prevStep} disabled={isBuilding || isRepairing}>Back</button>
                            {/* Show repair button if dep check found missing tools OR build failed with CMake error */}
                            {(depsOk === false || buildLogs.some(l => l.includes('CMake configuration failed'))) && !isRepairing && (
                                <button className="btn-primary warning" onClick={repairEnvironment}>
                                    Auto-Repair Environment (Install Toolchain)
                                </button>
                            )}
                            {!buildSuccess ? (
                                <>
                                    <button className="btn-primary" onClick={startBuild} disabled={isBuilding || isRepairing}>
                                        {isBuilding ? 'Compiling Sources...' : 'Start Optimized Build'}
                                    </button>
                                    {!isBuilding && !isRepairing && (
                                        <button className="btn-ghost" onClick={nextStep} title="Skip build step (no native GPU acceleration)">
                                            Skip (Web-Only Mode)
                                        </button>
                                    )}
                                </>
                            ) : (
                                <button className="btn-primary" onClick={nextStep}>Continue to Sync</button>
                            )}
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-pane animate-in">
                        <h2>Network Synchronization</h2>
                        <p>Connecting to BoltEVM Quai Stratum nodes...</p>
                        <div className="sync-progress">
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${syncProgress}%` }}></div>
                            </div>
                            <span>Synchronizing block headers... {syncProgress}%</span>
                        </div>
                        <div className="actions">
                            <button className="btn-ghost" onClick={prevStep}>Back</button>
                            <button className="btn-primary" onClick={nextStep} disabled={syncProgress < 100}>
                                {syncProgress < 100 ? 'Syncing...' : 'Continue to Rewards'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="step-pane animate-in">
                        <h2>Reward Allocation</h2>
                        <p>Enter your Quai Network address to receive mining rewards.</p>

                        <div className="wallet-input-container">
                            <label>Payout Address (Cyprus-1 Zone)</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={wallet}
                                onChange={(e) => setWallet(e.target.value)}
                                className="glass-input"
                            />
                            <p className="input-hint">Ensure this is a Cyprus-1 address (e.g. starts with 0x00... through 0x0D...)</p>
                        </div>

                        <div className="actions">
                            <button className="btn-ghost" onClick={prevStep}>Back</button>
                            <button
                                className="btn-primary"
                                onClick={nextStep}
                                disabled={(() => {
                                    if (!wallet || wallet.length < 42) return true;
                                    if (!wallet.startsWith('0x')) return true;
                                    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return true;
                                    return false;
                                })()}
                            >
                                Finalize Configuration
                            </button>
                        </div>
                    </div>
                )}

                {(currentStep === 6) && (
                    <div className="step-pane animate-in center">
                        <div className="success-icon"><Rocket size={48} /></div>
                        <h2>Ready to Launch!</h2>
                        <p>Your miner is optimized, synchronized, and rewards are set.</p>
                        <div className="summary-box">
                            <div className="s-row"><span>Wallet</span> <span className="truncate">{wallet}</span></div>
                            <div className="s-row"><span>Mode</span> <span className="capitalize">{miningMode} Mining</span></div>
                            {(miningMode === 'gpu' || miningMode === 'dual') && (
                                <div className="s-row"><span>GPUs</span> <span style={{ textAlign: 'right' }}>{gpus.join(', ')}</span></div>
                            )}
                            {(miningMode === 'cpu' || miningMode === 'dual') && (
                                <div className="s-row"><span>CPU</span> <span style={{ textAlign: 'right' }}>{cpu?.name}</span></div>
                            )}
                            <div className="s-row"><span>Profile</span> <span className="capitalize">{profile}</span></div>
                            <div className="s-row"><span>Node</span> <span>Quai Mainnet</span></div>
                        </div>
                        <button className="btn-primary large" onClick={() => {
                            localStorage.setItem('miner_state', JSON.stringify({
                                active: true,
                                mode: miningMode,
                                wallet: wallet,
                                profile: profile,
                                gpus: gpus,
                                cpu: cpu,
                                optimized: buildSuccess
                            }));
                            window.location.href = '/';
                        }}>Launch BoltEVM Miner</button>
                    </div>
                )}
            </div>

            <style jsx>{`
        .wizard-container { max-width: 800px; margin: 0 auto; width: 100%; }
        .stepper { display: flex; justify-content: space-between; margin-bottom: 40px; position: relative; }
        .stepper::before { content: ''; position: absolute; top: 20px; left: 0; right: 0; height: 2px; background: var(--glass-border); z-index: 0; }
        .step-item { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .step-icon { width: 40px; height: 40px; background: var(--bg-primary); border: 2px solid var(--glass-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all 0.3s; }
        .step-item.active .step-icon { border-color: var(--accent-cyan); color: var(--accent-cyan); box-shadow: 0 0 15px rgba(0, 242, 255, 0.3); }
        .step-item.completed .step-icon { background: var(--accent-cyan); border-color: var(--accent-cyan); color: var(--bg-primary); }
        .step-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .step-item.active .step-title { color: white; }
        
        .wizard-content { padding: 48px; min-height: 400px; display: flex; flex-direction: column; }
        .step-pane h2 { font-size: 28px; margin-bottom: 12px; }
        .step-pane p { color: var(--text-secondary); margin-bottom: 32px; }
        
        .detection-box { background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 32px; margin-bottom: 32px; border: 1px dashed var(--glass-border); text-align: center; }
        .scanning { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .scanner-line { width: 100%; height: 2px; background: var(--accent-cyan); animation: scan 2s infinite linear; }
        @keyframes scan { 0% { opacity: 0; transform: translateY(-20px); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(20px); } }
        
        .gpu-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .gpu-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--glass-bg); border-radius: 8px; font-size: 14px; }
        .hardware-section { margin-bottom: 24px; text-align: left; }
        .hardware-section h4 { font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .mode-selection { border-top: 1px solid var(--glass-border); padding-top: 32px; margin-top: 8px; }
        .mode-selection h3 { font-size: 18px; margin-bottom: 20px; text-align: center; }
        .status-success { margin-top: 16px; color: #00ff7f; font-weight: 600; text-align: center; font-size: 14px; }
        
        .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .profile-card { padding: 20px; border: 1px solid var(--glass-border); border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .profile-card:hover { border-color: var(--accent-cyan); transform: translateY(-2px); }
        .profile-card.selected { background: rgba(0, 242, 255, 0.1); border-color: var(--accent-cyan); box-shadow: 0 0 15px rgba(0, 242, 255, 0.1); }
        .profile-card h3 { margin: 8px 0; font-size: 15px; }
        .profile-card p { font-size: 11px; margin-bottom: 0; line-height: 1.4; color: var(--text-secondary); }
        
        .build-terminal { background: #0c0d12; border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 32px; overflow: hidden; }
        .terminal-header { background: rgba(255, 255, 255, 0.05); padding: 8px 16px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border); }
        .terminal-body { padding: 16px; height: 200px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #aaa; text-align: left; scroll-behavior: smooth; }
        .log-line { margin-bottom: 4px; border-left: 2px solid transparent; padding-left: 8px; }
        .log-line.err { color: #ff5555; border-left-color: #ff5555; }
        .log-line.success { color: #50fa7b; font-weight: bold; border-left-color: #50fa7b; }
        .empty-terminal { height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.5; font-style: italic; }

        .sync-progress { margin-bottom: 32px; }
        .progress-bar { height: 8px; background: var(--glass-border); border-radius: 4px; margin-bottom: 8px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--gradient-primary); transition: width 0.5s; }
        
        .actions { display: flex; gap: 16px; margin-top: auto; }
        .btn-ghost { background: transparent; border: 1px solid var(--glass-border); color: white; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
        .btn-primary.warning { background: #ff9800; border-color: #ff9800; color: #000; font-weight: 700; margin-right: 12px; }
        .btn-primary.warning:hover { background: #f57c00; box-shadow: 0 0 15px rgba(255, 152, 0, 0.4); }
        .center { align-items: center; text-align: center; justify-content: center; }
        .success-icon { width: 80px; height: 80px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 0 30px rgba(0, 242, 255, 0.4); }
        .summary-box { background: var(--glass-bg); padding: 20px; border-radius: 12px; width: 100%; max-width: 300px; margin-bottom: 32px; }
        .s-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border); font-size: 14px; }
        .s-row:last-child { border: none; }
        .capitalize { text-transform: capitalize; font-weight: 600; color: var(--accent-cyan); }
        .truncate { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent-cyan); font-family: monospace; }
        .wallet-input-container { margin-bottom: 32px; text-align: left; }
        .wallet-input-container label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; }
        .glass-input { width: 100%; background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 14px 18px; border-radius: 8px; color: white; font-family: monospace; font-size: 14px; outline: none; transition: border-color 0.2s; }
        .glass-input:focus { border-color: var(--accent-cyan); }
        .input-hint { font-size: 11px; color: var(--text-secondary); margin-top: 8px; }
        .animate-in { animation: fadeIn 0.4s ease-out; }

        .deps-panel { margin-bottom: 20px; overflow: hidden; }
        .deps-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255,255,255,0.04); border-bottom: 1px solid var(--glass-border); font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-recheck { background: transparent; border: 1px solid var(--glass-border); color: var(--accent-cyan); border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
        .btn-recheck:hover { border-color: var(--accent-cyan); background: rgba(0,242,255,0.05); }
        .btn-recheck:disabled { opacity: 0.5; cursor: not-allowed; }
        .deps-list { padding: 8px 0; }
        .dep-row { display: flex; align-items: flex-start; gap: 12px; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .dep-row:last-child { border: none; }
        .dep-row.ok { }
        .dep-row.missing { background: rgba(255, 85, 85, 0.04); }
        .dep-row.warn  { background: rgba(255, 204, 0, 0.03); }
        .dep-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
        .dep-info { display: flex; flex-direction: column; gap: 2px; }
        .dep-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .dep-version { font-size: 11px; color: #50fa7b; font-family: monospace; }
        .dep-hint { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
        .deps-scanning { display: flex; align-items: center; gap: 10px; padding: 14px 16px; color: var(--text-secondary); font-size: 13px; }
      `}</style>
        </div>
    );
}
