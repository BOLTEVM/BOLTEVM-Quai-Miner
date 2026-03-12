'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface Log {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: string;
}

export default function MiningConsole() {
    const [logs, setLogs] = useState<Log[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const logId = useRef(0);

    const addLog = (message: string, type: Log['type'] = 'info') => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        const newLog: Log = {
            id: logId.current++,
            message,
            type,
            timestamp
        };
        setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50 logs
    };

    useEffect(() => {
        // Initial logs
        addLog('BoltEVM Miner v1.0.4 initialized...', 'info');
        addLog('Connecting to Quai Network Cyprus-1...', 'info');
        addLog('GPU Workers detected: 1 [RTX 2070]', 'success');
        addLog('CPU Threads initialized: 8', 'success');
        addLog('Mining sequence started.', 'success');

        const intervals = [
            // Solution interval (every 4-7s)
            setInterval(() => {
                const hash = Math.random().toString(16).substring(2, 10);
                addLog(`Solution found: 0x${hash}... submitted`, 'info');
            }, 5000),

            // Block height update (every 15s)
            setInterval(() => {
                const height = 1205400 + Math.floor(Date.now() / 100000);
                addLog(`New Block Height: # ${height}`, 'success');
            }, 15000),

            // Reward event (rare)
            setInterval(() => {
                addLog(`Block Reward Accepted! +0.42 QUAI`, 'success');
            }, 45000)
        ];

        return () => intervals.forEach(i => clearInterval(i));
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
                    <div className="dot"></div>
                    Connected: cyprus1.rpc.quai.network
                </div>
            </div>
            <div className="console-body" ref={scrollRef}>
                {logs.map(log => (
                    <div key={log.id} className={`log-line type-${log.type}`}>
                        <span className="timestamp">[{log.timestamp}]</span>
                        <span className="message">{log.message}</span>
                    </div>
                ))}
                <div className="cursor">_</div>
            </div>

            <style jsx>{`
        .console-container {
          margin-top: 24px;
          padding: 0;
          overflow: hidden;
          background: rgba(5, 6, 10, 0.8);
          border: 1px solid var(--glass-border);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--glass-border);
        }
        .title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .terminal-icon {
          color: var(--accent-cyan);
        }
        .connection-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 20px;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: #00ff7f;
          border-radius: 50%;
          box-shadow: 0 0 8px #00ff7f;
        }
        .console-body {
          height: 200px;
          padding: 20px;
          overflow-y: auto;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.6;
          scroll-behavior: smooth;
        }
        .console-body::-webkit-scrollbar {
          width: 4px;
        }
        .console-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .log-line {
          display: flex;
          gap: 12px;
          margin-bottom: 4px;
        }
        .timestamp {
          color: #666;
          flex-shrink: 0;
        }
        .type-info .message { color: var(--text-secondary); }
        .type-success .message { color: #00ff7f; font-weight: 500; }
        .type-warning .message { color: #ffcc00; }
        .type-error .message { color: #ff453a; }
        
        .cursor {
          display: inline-block;
          color: var(--accent-cyan);
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out backwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
