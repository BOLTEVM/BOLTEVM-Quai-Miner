'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import MinerTable, { WorkerItem } from '../../components/MinerTable';
import { Plus, X, Server, Cpu as CpuIcon, ShieldCheck } from 'lucide-react';
import { useMinerState } from '../../hooks/useMinerState';

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export default function MinersPage() {
  const { state, addCustomWorker } = useMinerState();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Detected hardware from API
  const [detectedGpus, setDetectedGpus] = useState<string[]>([]);
  const [detectedCpu, setDetectedCpu] = useState<string>('Generic CPU');

  // Form State
  const [workerCategory, setWorkerCategory] = useState<'gpu' | 'cpu' | 'remote'>('gpu');
  const [workerId, setWorkerId] = useState('');
  const [selectedHardware, setSelectedHardware] = useState('');
  const [intensity, setIntensity] = useState('Medium (Standard)');
  const [stratumPool, setStratumPool] = useState('stratum+tcp://quai.pool.bolt-evm.com:3333');
  const [wallet, setWallet] = useState('');

  useEffect(() => {
    if (state.wallet) setWallet(state.wallet);

    fetch('/api/hardware')
      .then(res => res.json())
      .then(data => {
        if (data.gpus && data.gpus.length > 0) {
          const names = data.gpus.map((g: any) => typeof g === 'string' ? g : g.name);
          setDetectedGpus(names);
          setSelectedHardware(names[0]);
        } else {
          setDetectedGpus(['NVIDIA RTX 4090', 'NVIDIA RTX 3080']);
          setSelectedHardware('NVIDIA RTX 4090');
        }
        if (data.cpu) {
          setDetectedCpu(data.cpu.name || 'Generic CPU');
        }
      })
      .catch(() => {
        setDetectedGpus(['NVIDIA RTX 4090', 'NVIDIA RTX 3080']);
        setSelectedHardware('NVIDIA RTX 4090');
      });
  }, [state.wallet]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleOpenModal = () => {
    const defaultNum = Math.floor(Math.random() * 89 + 10);
    setWorkerId(workerCategory === 'gpu' ? `BOLT-GPU-${defaultNum}` : workerCategory === 'cpu' ? `BOLT-CPU-${defaultNum}` : `BOLT-NODE-${defaultNum}`);
    setIsModalOpen(true);
  };

  const handleAddWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId.trim()) {
      addToast('Please specify a valid Worker ID.', 'error');
      return;
    }

    const newWorker: WorkerItem = {
      id: workerId.trim(),
      type: workerCategory === 'remote' ? `Remote Node (${stratumPool.replace('stratum+tcp://', '')})` : (selectedHardware || detectedCpu),
      hardwareCategory: workerCategory,
      hashrate: workerCategory === 'gpu' ? '450.00 MH/s' : '22.50 MH/s',
      numericHashrate: workerCategory === 'gpu' ? 450 : 22.5,
      temp: workerCategory === 'gpu' ? '61°C' : '49°C',
      status: 'Online' as const,
      targetPool: stratumPool,
      intensity: intensity
    };

    addCustomWorker(newWorker);

    addToast(`Worker ${newWorker.id} successfully configured and deployed!`, 'success');
    setIsModalOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Miner Management</h1>
            <p>Monitor, control, and deploy hardware workers and remote mining nodes.</p>
          </div>
          <button className="btn-primary flex-items" onClick={handleOpenModal}>
            <Plus size={20} />
            <span>Add Worker</span>
          </button>
        </header>

        {/* Toasts overlay */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <ShieldCheck size={16} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        <MinerTable refreshTrigger={refreshTrigger} onToast={addToast} />

        {/* Add Worker Dialog / Modal */}
        {isModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h3>Add Mining Worker Node</h3>
                <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddWorkerSubmit} className="modal-form">
                <div className="form-group">
                  <label>Worker Category</label>
                  <div className="category-selector">
                    <button
                      type="button"
                      className={`cat-btn ${workerCategory === 'gpu' ? 'active' : ''}`}
                      onClick={() => { setWorkerCategory('gpu'); setSelectedHardware(detectedGpus[0] || 'NVIDIA GPU'); }}
                    >
                      <CpuIcon size={16} /> Local GPU
                    </button>
                    <button
                      type="button"
                      className={`cat-btn ${workerCategory === 'cpu' ? 'active' : ''}`}
                      onClick={() => { setWorkerCategory('cpu'); setSelectedHardware(detectedCpu); }}
                    >
                      <CpuIcon size={16} /> Local CPU
                    </button>
                    <button
                      type="button"
                      className={`cat-btn ${workerCategory === 'remote' ? 'active' : ''}`}
                      onClick={() => { setWorkerCategory('remote'); setSelectedHardware('Remote Node'); }}
                    >
                      <Server size={16} /> Remote Node
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Worker ID</label>
                  <input
                    type="text"
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    placeholder="e.g. BOLT-GPU-02"
                    required
                  />
                </div>

                {workerCategory === 'gpu' && (
                  <div className="form-group">
                    <label>Select Hardware</label>
                    <select value={selectedHardware} onChange={(e) => setSelectedHardware(e.target.value)}>
                      {detectedGpus.map((gpu, idx) => (
                        <option key={idx} value={gpu}>{gpu}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Mining Intensity</label>
                  <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
                    <option value="Low (Power Save)">Low (Power Save)</option>
                    <option value="Medium (Standard)">Medium (Standard)</option>
                    <option value="High (Performance)">High (Performance)</option>
                    <option value="Extreme (Max Overclock)">Extreme (Max Overclock)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Stratum Pool</label>
                  <input
                    type="text"
                    value={stratumPool}
                    onChange={(e) => setStratumPool(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Deploy Worker</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .page-container { display: flex; min-height: 100vh; }
        .main-content { flex: 1; padding: 48px; display: flex; flex-direction: column; gap: 32px; position: relative; }
        .page-header { display: flex; justify-content: space-between; align-items: center; }
        .page-header h1 { font-size: 32px; margin-bottom: 8px; }
        .page-header p { color: var(--text-secondary); }
        .flex-items { display: flex; align-items: center; gap: 8px; }

        .toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 1000; }
        .toast { padding: 12px 20px; border-radius: 8px; font-size: 14px; display: flex; align-items: center; gap: 10px; background: rgba(15, 18, 35, 0.95); border: 1px solid var(--glass-border); box-shadow: 0 8px 32px rgba(0,0,0,0.5); animation: slideIn 0.2s ease-out; }
        .toast.success { border-color: rgba(0, 255, 127, 0.4); color: #00ff7f; }
        .toast.warning { border-color: rgba(255, 159, 10, 0.4); color: #ff9f0a; }
        .toast.error { border-color: rgba(255, 69, 58, 0.4); color: #ff453a; }
        .toast.info { border-color: rgba(0, 242, 255, 0.4); color: var(--accent-cyan); }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 999; }
        .modal-content { width: 480px; background: #0f1223 !important; border: 1px solid var(--glass-border); padding: 32px; border-radius: 16px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .close-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; }
        .close-btn:hover { color: white; }

        .modal-form { display: flex; flex-direction: column; gap: 18px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
        .form-group input, .form-group select { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: 8px; padding: 10px 14px; color: white; outline: none; }
        .form-group input:focus, .form-group select:focus { border-color: var(--accent-cyan); }

        .category-selector { display: flex; gap: 8px; }
        .cat-btn { flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); color: var(--text-secondary); padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; }
        .cat-btn.active { background: rgba(0, 242, 255, 0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); font-weight: 600; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }
        .btn-secondary { background: transparent; border: 1px solid var(--glass-border); color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
      `}</style>
    </div>
  );
}
