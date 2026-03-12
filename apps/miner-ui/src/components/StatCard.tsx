export default function StatCard({ title, value, icon: Icon, trend }: any) {
    return (
        <div className="glass-card stat-card">
            <div className="card-header">
                <div className="icon-wrapper">
                    <Icon size={24} color="var(--accent-cyan)" />
                </div>
                {trend && (
                    <span className={`trend ${trend > 0 ? 'positive' : 'negative'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <div className="card-body">
                <span className="stat-title">{title}</span>
                <h3 className="stat-value">{value}</h3>
            </div>
            <style jsx>{`
        .stat-card {
          flex: 1;
          min-width: 200px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .icon-wrapper {
          padding: 10px;
          background: rgba(0, 242, 255, 0.1);
          border-radius: 12px;
          color: var(--accent-cyan);
        }
        .trend {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 20px;
        }
        .positive { background: rgba(0, 255, 127, 0.1); color: #00ff7f; }
        .negative { background: rgba(255, 69, 58, 0.1); color: #ff453a; }
        .stat-title {
          font-size: 14px;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
        }
      `}</style>
        </div>
    )
}
