'use client';

import { useState, useEffect } from 'react';
import { estimateHashrate, formatHashrate } from '../utils/hashrate';

export default function MinerTable() {
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    const storedState = localStorage.getItem('miner_state');
    if (storedState) {
      const state = JSON.parse(storedState);
      const items = [];

      if (state.active) {
        if (state.mode === 'gpu' || state.mode === 'dual') {
          state.gpus.forEach((gpu: string, i: number) => {
            const estimation = estimateHashrate(gpu, 'gpu');
            items.push({
              id: `BOLT-GPU-${i + 1}`,
              type: gpu,
              hashrate: formatHashrate(estimation.value, estimation.unit),
              temp: '62°C',
              status: 'Online'
            });
          });
        }

        if (state.mode === 'cpu' || state.mode === 'dual') {
          const cpuName = state.cpu?.name || 'Generic CPU';
          const estimation = estimateHashrate(cpuName, 'cpu');
          items.push({
            id: 'BOLT-CPU-01',
            type: cpuName,
            hashrate: formatHashrate(estimation.value, estimation.unit),
            temp: '51°C',
            status: 'Online'
          });
        }
      }
      setWorkers(items);
    }
  }, []);

  return (
    <div className="glass-card table-container">
      <table>
        <thead>
          <tr>
            <th>Worker ID</th>
            <th>Hardware</th>
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
              <td className="accent-text">{miner.hashrate}</td>
              <td>{miner.temp}</td>
              <td>
                <span className={`status-pill ${miner.status.toLowerCase()}`}>
                  {miner.status}
                </span>
              </td>
              <td>
                <button className="action-btn">Reboot</button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                No active workers. Complete the <a href="/setup" style={{ color: 'var(--accent-cyan)' }}>1-Click Setup</a> to start mining.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <style jsx>{`
        .table-container {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        th {
          padding: 16px;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 14px;
          border-bottom: 1px solid var(--glass-border);
        }
        td {
          padding: 16px;
          border-bottom: 1px solid var(--glass-border);
        }
        .font-bold { font-weight: 600; }
        .text-secondary { color: var(--text-secondary); font-size: 14px; }
        .accent-text { color: var(--accent-cyan); font-weight: 600; }
        .status-pill {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-pill.online { background: rgba(0, 255, 127, 0.1); color: #00ff7f; }
        .status-pill.warning { background: rgba(255, 159, 10, 0.1); color: #ff9f0a; }
        .status-pill.offline { background: rgba(255, 69, 58, 0.1); color: #ff453a; }
        .action-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
