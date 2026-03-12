'use client';

export default function HashrateChart() {
    // Simple mock SVG chart
    const points = "0,80 50,60 100,75 150,40 200,55 250,30 300,50 350,20 400,45";

    return (
        <div className="glass-card chart-container">
            <div className="chart-header">
                <h4>Hashrate History (GH/s)</h4>
                <div className="time-filters">
                    <button className="active">1H</button>
                    <button>24H</button>
                    <button>7D</button>
                </div>
            </div>
            <div className="chart-body">
                <svg viewBox="0 0 400 100" className="chart-svg">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polyline
                        fill="url(#chartGradient)"
                        stroke="none"
                        points={`${points} 400,100 0,100`}
                    />
                    <polyline
                        fill="none"
                        stroke="var(--accent-cyan)"
                        strokeWidth="2"
                        points={points}
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <style jsx>{`
        .chart-container {
          margin-top: 24px;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .time-filters {
          display: flex;
          gap: 8px;
        }
        .time-filters button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .time-filters button.active {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }
        .chart-svg {
          width: 100%;
          height: 200px;
        }
      `}</style>
        </div>
    )
}
