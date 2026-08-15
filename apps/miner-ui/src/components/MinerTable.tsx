'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Play, Pause, RotateCw, Trash2, Power } from 'lucide-react';
import { estimateHashrate, formatHashrate } from '../utils/hashrate';

import { useMinerState } from '../hooks/useMinerState';

export interface WorkerItem {
  id: string;
  type: string;
  hardwareCategory: 'gpu' | 'cpu' | 'remote';
  hashrate: string;
  numericHashrate: number;
  temp: string;
  status: 'Online' | 'Rebooting' | 'Paused' | 'Offline' | 'Error';
  targetPool?: string;
  intensity?: string;
}

interface MinerTableProps {
  refreshTrigger?: number;
  onToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function MinerTable({ refreshTrigger, onToast }: MinerTableProps) {
  const { state, updateState } = useMinerState();
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const saveCustomWorkers = (baseState: any, items: WorkerItem[]) => {
    updateState({ customWorkers: items as any });
  };

  const loadWorkers = async () => {
    const storedState = localStorage.getItem('miner_state');
    let fetchedTemps: { [key: string]: string } = {};

    try {
      const res = await fetch('/api/hardware');
      if (res.ok) {
        const hwData = await res.json();
        if (hwData.gpus) {
          hwData.gpus.forEach((g: any, idx: number) => {
            const tempVal = typeof g === 'object' ? g.temp : 62;
            fetchedTemps[`gpu_${idx}`] = `${tempVal}°C`;
          });
        }
        if (hwData.cpu) {
          fetchedTemps['cpu'] = `${hwData.cpu.temp || 51}°C`;
        }
      }
    } catch (e) {}

    if (storedState) {
      try {
        const state = JSON.parse(storedState);
        if (!state || typeof state !== 'object') return;

        const items: WorkerItem[] = [];

        if (state.customWorkers && Array.isArray(state.customWorkers) && state.customWorkers.length > 0) {
          // Merge dynamic thermal sensor readings into existing custom workers
          const updated = state.customWorkers.map((w: WorkerItem, idx: number) => ({
            ...w,
            temp: w.hardwareCategory === 'cpu' ? (fetchedTemps['cpu'] || w.temp) : (fetchedTemps[`gpu_${idx}`] || w.temp)
          }));
          setWorkers(updated);
          return;
        }

        if (state.active) {
          if (state.mode === 'gpu' || state.mode === 'dual') {
            (state.gpus || []).forEach((gpu: any, i: number) => {
              const gpuName = typeof gpu === 'string' ? gpu : (gpu?.name || 'NVIDIA GPU');
              const estimation = estimateHashrate(gpuName, 'gpu');
              items.push({
                id: `BOLT-GPU-${i + 1}`,
                type: gpuName,
                hardwareCategory: 'gpu',
                hashrate: formatHashrate(estimation.value, estimation.unit),
                numericHashrate: estimation.value,
                temp: fetchedTemps[`gpu_${i}`] || '62°C',
                status: 'Online',
                targetPool: state.stratum || 'stratum+tcp://quai-kawpow.kryptex.network:7043',
                intensity: state.intensity || 'Medium (Standard)'
              });
            });
          }

          if (state.mode === 'cpu' || state.mode === 'dual') {
            const cpuName = typeof state.cpu === 'string' ? state.cpu : (state.cpu?.name || 'Generic CPU');
            const estimation = estimateHashrate(cpuName, 'cpu');
            items.push({
              id: 'BOLT-CPU-01',
              type: cpuName,
              hardwareCategory: 'cpu',
              hashrate: formatHashrate(estimation.value, estimation.unit),
              numericHashrate: estimation.value,
              temp: fetchedTemps['cpu'] || '51°C',
              status: 'Online',
              targetPool: state.stratum || 'stratum+tcp://quai-kawpow.kryptex.network:7043',
              intensity: state.intensity || 'Medium (Standard)'
            });
          }
        }
        setWorkers(items);
        saveCustomWorkers(state, items);
      } catch (e) {}
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [refreshTrigger]);

  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:8081');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PROGRESS' && data.hashrate) {
            setWorkers(prev => (prev || []).map(w => {
              if (w.status === 'Online') {
                const liveHr = data.hashrate;
                return {
                  ...w,
                  hashrate: liveHr >= 1000 ? `${(liveHr / 1000).toFixed(2)} GH/s` : `${liveHr.toFixed(2)} MH/s`,
                  numericHashrate: liveHr
                };
              }
              return w;
            }));
          } else if (data.type === 'REBOOT_COMPLETE' && data.targetWorker) {
            setWorkers(prev => (prev || []).map(w => w.id === data.targetWorker ? { ...w, status: 'Online' } : w));
            onToast?.(`Worker ${data.targetWorker} reboot sequence completed.`, 'success');
          }
        } catch (e) {}
      };

      return () => {
        ws.close();
      };
    } catch (e) {}
  }, []);

  const handleReboot = (workerId: string) => {
    onToast?.(`Initiating reboot sequence for ${workerId}...`, 'warning');

    setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status: 'Rebooting' as const } : w));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REBOOT', targetWorker: workerId }));
    }

    setTimeout(() => {
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status: 'Online' } : w));
      onToast?.(`Worker ${workerId} is online and operational.`, 'success');
    }, 2500);
  };

  const handleTogglePause = (workerId: string) => {
    setWorkers(prev => {
      const updated = prev.map(w => {
        if (w.id === workerId) {
          const newStatus: WorkerItem['status'] = w.status === 'Paused' ? 'Online' : 'Paused';
          onToast?.(`Worker ${workerId} is now ${newStatus.toLowerCase()}.`, newStatus === 'Online' ? 'success' : 'info');
          return { ...w, status: newStatus };
        }
        return w;
      });
      const stored = localStorage.getItem('miner_state');
      if (stored) saveCustomWorkers(JSON.parse(stored), updated);
      return updated;
    });
  };

  const handleStop = (workerId: string) => {
    setWorkers(prev => {
      const updated = prev.map(w => {
        if (w.id === workerId) {
          onToast?.(`Worker ${workerId} stopped.`, 'warning');
          return { ...w, status: 'Offline' as const, hashrate: '0.00 MH/s' };
        }
        return w;
      });
      const stored = localStorage.getItem('miner_state');
      if (stored) saveCustomWorkers(JSON.parse(stored), updated);
      return updated;
    });
  };

  const handleRemove = (workerId: string) => {
    setWorkers(prev => {
      const updated = prev.filter(w => w.id !== workerId);
      onToast?.(`Worker ${workerId} removed.`, 'error');
      const stored = localStorage.getItem('miner_state');
      if (stored) saveCustomWorkers(JSON.parse(stored), updated);
      return updated;
    });
  };

  return (
    <div className="glass-card table-container">
      <table>
        <thead>
          <tr>
            <th>Worker ID</th>
            <th>Hardware / Node</th>
            <th>Hashrate</th>
            <th>Temp</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workers.length > 0 ? workers.map((miner) => (
            <tr key={miner.id}>
              <td className="font-bold">{miner.id}</td>
              <td className="text-secondary">{miner.type}</td>
              <td className="accent-text">{miner.status === 'Online' ? miner.hashrate : '0.00 MH/s'}</td>
              <td>{miner.temp}</td>
              <td>
                <span className={`status-pill ${
                  miner.status === 'Online' ? 'online' :
                  miner.status === 'Rebooting' ? 'warning' :
                  miner.status === 'Paused' ? 'paused' : 'offline'
                }`}>
                  {miner.status}
                </span>
              </td>
              <td className="actions-cell">
                <button
                  className="action-btn reboot-btn"
                  title="Reboot Worker"
                  disabled={miner.status === 'Rebooting'}
                  onClick={() => handleReboot(miner.id)}
                >
                  <RotateCw size={14} className={miner.status === 'Rebooting' ? 'spin' : ''} />
                  <span>Reboot</span>
                </button>

                <button
                  className="action-btn icon-only"
                  title={miner.status === 'Paused' ? 'Resume Mining' : 'Pause Mining'}
                  onClick={() => handleTogglePause(miner.id)}
                >
                  {miner.status === 'Paused' ? <Play size={14} /> : <Pause size={14} />}
                </button>

                <button
                  className="action-btn icon-only stop-btn"
                  title="Stop Worker"
                  onClick={() => handleStop(miner.id)}
                >
                  <Power size={14} />
                </button>

                <button
                  className="action-btn icon-only remove-btn"
                  title="Remove Worker"
                  onClick={() => handleRemove(miner.id)}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                No active workers. Complete the <Link href="/setup" style={{ color: 'var(--accent-cyan)' }}>1-Click Setup</Link> or click <strong>+ Add Worker</strong> above to start.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <style jsx>{`
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { padding: 16px; color: var(--text-secondary); font-weight: 500; font-size: 14px; border-bottom: 1px solid var(--glass-border); }
        td { padding: 16px; border-bottom: 1px solid var(--glass-border); }
        .font-bold { font-weight: 600; }
        .text-secondary { color: var(--text-secondary); font-size: 14px; }
        .accent-text { color: var(--accent-cyan); font-weight: 600; }
        
        .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-pill.online { background: rgba(0, 255, 127, 0.1); color: #00ff7f; }
        .status-pill.warning { background: rgba(255, 159, 10, 0.15); color: #ff9f0a; }
        .status-pill.paused { background: rgba(0, 242, 255, 0.1); color: var(--accent-cyan); }
        .status-pill.offline { background: rgba(255, 69, 58, 0.1); color: #ff453a; }
        
        .actions-cell { display: flex; align-items: center; gap: 6px; }
        .action-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .action-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.3); }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .icon-only { padding: 6px; }
        .stop-btn:hover { background: rgba(255, 159, 10, 0.2); color: #ff9f0a; }
        .remove-btn:hover { background: rgba(255, 69, 58, 0.2); color: #ff453a; }
        
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
