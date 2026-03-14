export default function StatCard({ title, value, subValue, icon: Icon, trend, live, onClick }: any) {
  return (
    <div className={`glass-card stat-card animate-slide-up ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="card-header">
        <div className={`icon-wrapper ${live ? 'live-icon' : ''}`}>
          <Icon size={24} color="var(--accent-cyan)" />
          {live && <div className="pulse-dot"></div>}
        </div>
        {trend && (
          <span className={`trend ${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="card-body">
        <span className="stat-title">{title}</span>
        <h3 className="stat-value">{value}</h3>
        {subValue && <div className="stat-subvalue">{subValue}</div>}
      </div>
      <style jsx>{`
        .stat-card {
          flex: 1;
          min-width: 200px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2), 0 0 15px rgba(0, 242, 255, 0.1);
          border-color: rgba(0, 242, 255, 0.3);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .icon-wrapper {
          position: relative;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          color: var(--accent-cyan);
          transition: all 0.3s ease;
        }
        .live-icon {
          background: rgba(0, 242, 255, 0.1);
          box-shadow: 0 0 15px rgba(0, 242, 255, 0.1);
        }
        .pulse-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          background: #00ff7f;
          border-radius: 50%;
          border: 2px solid #0a0b14;
          box-shadow: 0 0 10px #00ff7f;
          animation: pulse-ring 2s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(0, 255, 127, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(0, 255, 127, 0); }
          100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(0, 255, 127, 0); }
        }
        .trend {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.02em;
        }
        .positive { background: rgba(0, 255, 127, 0.1); color: #00ff7f; }
        .negative { background: rgba(255, 69, 58, 0.1); color: #ff453a; }
        .stat-title {
          font-size: 13px;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .stat-subvalue {
          font-size: 13px;
          color: var(--accent-cyan);
          margin-top: 4px;
          font-weight: 600;
          opacity: 0.9;
        }
        .clickable {
          cursor: pointer;
        }
        .animate-slide-up {
          animation: slideUp 0.6s ease-out backwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
