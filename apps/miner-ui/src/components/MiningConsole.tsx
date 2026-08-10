'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, ChevronRight } from 'lucide-react';
import { estimateHashrate, convertToMHs } from '../utils/hashrate';

interface Log {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface MiningConsoleProps {
  onBlockFound?: () => void;
  onHashrateUpdate?: (mh: number, engine?: 'CUDA') => void;
  onShareAccepted?: (shareInfo?: { nonce?: string; difficulty?: number }) => void;
}

export default function MiningConsole({ onBlockFound, onHashrateUpdate, onShareAccepted }: MiningConsoleProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [activePool, setActivePool] = useState('cyprus1.rpc.quai.network');
  const [isWorkerActive, setIsWorkerActive] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logId = useRef(0);

  const addLog = (message: string, type: Log['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    setLogs(prev => {
      if (prev.length > 0) {
        const lastLog = prev[prev.length - 1];
        const baseLastMsg = lastLog.message.replace(/\s*\(\s*x\d+\s*\)$/, '');
        if (baseLastMsg === message) {
          const match = lastLog.message.match(/\(\s*x(\d+)\s*\)$/);
          const count = match ? parseInt(match[1], 10) + 1 : 2;
          const updatedLastLog: Log = {
            ...lastLog,
            message: `${baseLastMsg} (x${count})`,
            timestamp
          };
          return [...prev.slice(0, -1), updatedLastLog];
        }
      }
      const newLog: Log = {
        id: logId.current++,
        message,
        type,
        timestamp
      };
      return [...prev.slice(-99), newLog]; // Keep last 100 logs
    });
  };

  useEffect(() => {
    const storedState = localStorage.getItem('miner_state');
    if (!storedState) {
      addLog('No miner configuration found. Please run 1-Click Setup Wizard.', 'warning');
      return;
    }

    let parsedState: any = {};
    try {
      parsedState = JSON.parse(storedState);
    } catch (e) {
      addLog('Failed to read miner configuration.', 'error');
      return;
    }

    const isMiningActive = parsedState.active === true;
    const poolUrl = parsedState.stratum || 'stratum+tcp://quai-kawpow.kryptex.network:7043';
    const intensity = parsedState.intensity || 'Medium (Standard)';

    if (parsedState.stratum) {
      const cleanUrl = parsedState.stratum.replace(/^(?:stratum\+(?:tcp|ssl|tls):\/\/)?/, '');
      setActivePool(cleanUrl);
    }

    addLog('BoltEVM Stratum Client Engine Initialized.', 'info');
    addLog(`Target Stratum Pool: ${poolUrl}`, 'info');
    addLog(`Mining Intensity Profile: ${intensity}`, 'info');

    if (isMiningActive) {
      addLog('Starting Hardware Hashing Worker Thread...', 'info');
      
      const minerWorker = new Worker(new URL('../workers/miner.worker.ts', import.meta.url));
      
      minerWorker.postMessage({
        type: 'START',
        intensity,
        wallet: parsedState.wallet,
        mode: parsedState.mode || 'gpu',
        gpus: parsedState.gpus || [],
        cpu: parsedState.cpu || null,
        profile: parsedState.profile || 'balanced',
        stratum: poolUrl
      });

      minerWorker.onmessage = (e) => {
        const { type, message, logType, hashrate, proof, nonce } = e.data;

        if (type === 'LOG') {
          addLog(message, logType || 'info');
        } else if (type === 'SHARE_ACCEPTED') {
          addLog(message || `Share Accepted! Nonce: ${nonce || '0x...'}`, 'success');
          if (onShareAccepted) {
            onShareAccepted({ nonce, difficulty: e.data.difficulty || 0.048 });
          }
        } else if (type === 'PROGRESS') {
          if (onHashrateUpdate) onHashrateUpdate(hashrate, 'CUDA');
        } else if (type === 'FOUND_BLOCK') {
          addLog(`[BLOCK SOLUTION] Real Block Solution Accepted! Proof: ${proof ? proof.substring(0, 24) : ''}...`, 'success');
          if (onBlockFound) onBlockFound();
        } else if (type === 'ERROR' || type === 'POOL_OFFLINE') {
          addLog(`[Daemon Connection Issue] ${message}`, 'error');
        }
      };

      workerRef.current = minerWorker;
      setIsWorkerActive(true);
    } else {
      addLog('Miner is currently paused. Go to Miners page to start.', 'warning');
    }

    let lastBlock = 0;
    const fetchBlock = async () => {
      try {
        const response = await fetch('/api/quai');
        const data = await response.json();
        if (data.blockHeight && data.blockHeight !== lastBlock) {
          addLog(`Network Block Detected: # ${data.blockHeight}`, 'info');
          lastBlock = data.blockHeight;
        }
      } catch (e) {
        addLog('Connection lag detected. Retrying...', 'warning');
      }
    };

    fetchBlock();
    const interval = setInterval(fetchBlock, 15000);

    return () => {
      clearInterval(interval);
      // workerRef.current always holds the live instance (not stale closure)
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-card console-container animate-fade-in">
      <div className="console-header">
        <div className="title-group">
          <Terminal size={18} className="terminal-icon" />
          <h4>Mining Process Console</h4>
        </div>
        <div className="connection-pill">
          <div className={`dot ${isWorkerActive ? 'active' : ''}`}></div>
          {isWorkerActive ? 'ACTIVE HASHING' : 'READY'} - {activePool}
        </div>
      </div>
      <div className="console-body" ref={scrollRef}>
        {logs.map((log) => (
          <div key={log.id} className={`log-entry ${log.type}`}>
            <span className="log-timestamp">[{log.timestamp}]</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .console-container { height: 400px; display: flex; flex-direction: column; background: rgba(10, 11, 20, 0.8) !important; border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; margin-top: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
        .console-header { padding: 12px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; }
        .title-group { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); }
        .terminal-icon { color: var(--accent-cyan); }
        .connection-pill { display: flex; align-items: center; gap: 8px; font-size: 11px; background: rgba(0, 242, 255, 0.05); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(0, 242, 255, 0.2); color: var(--accent-cyan); font-weight: 600; }
        .dot { width: 6px; height: 6px; background: #666; border-radius: 50%; }
        .dot.active { background: #00ff7f; box-shadow: 0 0 8px #00ff7f; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        
        .console-body { flex: 1; padding: 20px; overflow-y: auto; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.6; scroll-behavior: smooth; color: #d1d1d1; }
        .console-body::-webkit-scrollbar { width: 4px; }
        .console-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
        
        .log-entry { display: flex; gap: 12px; margin-bottom: 6px; animation: slideIn 0.2s ease-out forwards; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
        
        .log-timestamp { color: #5c6370; flex-shrink: 0; font-size: 11px; }
        .log-message { word-break: break-all; }
        
        .info { color: var(--text-secondary); }
        .success { color: #00ff7f; font-weight: 500; text-shadow: 0 0 10px rgba(0, 255, 127, 0.2); }
        .warning { color: #ffcc00; }
        .error { color: #ff453a; }
        
        .animate-fade-in { animation: fadeIn 0.6s ease-out backwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
