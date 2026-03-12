import { useState, useEffect } from 'react';

export default function HashrateChart() {
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D'>('1H');
  const [points, setPoints] = useState<number[]>([]);

  // Initial data generation based on timeframe
  useEffect(() => {
    const count = timeframe === '1H' ? 11 : timeframe === '24H' ? 24 : 14;
    const initial = Array.from({ length: count }, () => Math.floor(Math.random() * 40) + 40);
    setPoints(initial);
  }, [timeframe]);

  // Generate random points for the SVG polyline
  const generatePath = (data: number[]) => {
    const step = 400 / (data.length - 1);
    return data.map((y, i) => `${i * step},${100 - y}`).join(' ');
  };

  // Simulate real-time hashrate jitter for the short term
  useEffect(() => {
    const interval = setInterval(() => {
      if (timeframe !== '1H') return;
      setPoints(prev => {
        const next = [...prev.slice(1)];
        const last = prev[prev.length - 1];
        const change = (Math.random() - 0.5) * 8;
        const newValue = Math.max(20, Math.min(95, last + change));
        next.push(newValue);
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [timeframe]);

  const pathData = generatePath(points);

  return (
    <div className="glass-card chart-container animate-fade-in">
      <div className="chart-header">
        <div className="title-group">
          <h4>Hashrate History (GH/s)</h4>
          <div className="live-indicator">
            <div className="pulse"></div>
            <span>LIVE</span>
          </div>
        </div>
        <div className="time-filters">
          <button
            className={timeframe === '1H' ? 'active' : ''}
            onClick={() => setTimeframe('1H')}
          >1H</button>
          <button
            className={timeframe === '24H' ? 'active' : ''}
            onClick={() => setTimeframe('24H')}
          >24H</button>
          <button
            className={timeframe === '7D' ? 'active' : ''}
            onClick={() => setTimeframe('7D')}
          >7D</button>
        </div>
      </div>
      <div className="chart-body">
        {points.length > 0 && (
          <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="chart-svg">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <polyline
              fill="url(#chartGradient)"
              stroke="none"
              points={`${pathData} 400,100 0,100`}
              className="path-area"
            />
            <polyline
              fill="none"
              stroke="var(--accent-cyan)"
              strokeWidth="2.5"
              points={pathData}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="path-line"
              filter="url(#glow)"
            />
          </svg>
        )}
      </div>
      <style jsx>{`
        .chart-container {
          margin-top: 24px;
          position: relative;
          overflow: hidden;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 242, 255, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-cyan);
          letter-spacing: 0.05em;
        }
        .pulse {
          width: 6px;
          height: 6px;
          background: var(--accent-cyan);
          border-radius: 50%;
          animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(0, 242, 255, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(0, 242, 255, 0); }
          100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(0, 242, 255, 0); }
        }
        .time-filters {
          display: flex;
          gap: 8px;
        }
        .time-filters button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .time-filters button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .time-filters button.active {
          background: rgba(0, 242, 255, 0.1);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }
        .chart-body {
          position: relative;
          height: 220px;
        }
        .chart-svg {
          width: 100%;
          height: 100%;
        }
        .path-line {
          transition: all 0.5s ease-in-out;
        }
        .path-area {
          transition: all 0.5s ease-in-out;
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
