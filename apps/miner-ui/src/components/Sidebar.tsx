'use client';

import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings, Zap, Database, Cpu } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <aside className="sidebar glass-card">
      <div className="logo-section">
        <img src="/0logov3.png" alt="BoltEVM Logo" className="logo" />
        <h2>BoltEVM</h2>
      </div>
      <nav className="nav-menu">
        <a href="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </a>
        <a href="/setup" className={`nav-link ${isActive('/setup') ? 'active' : ''}`}>
          <Zap size={20} />
          <span>1-Click Setup</span>
        </a>
        <a href="/miners" className={`nav-link ${isActive('/miners') ? 'active' : ''}`}>
          <Users size={20} />
          <span>Miners</span>
        </a>
        <a href="/rewards" className={`nav-link ${isActive('/rewards') ? 'active' : ''}`}>
          <Zap size={20} />
          <span>Rewards</span>
        </a>
        <a href="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </a>
      </nav>
      <div className="sidebar-footer">
        <div className="status-item">
          <div className="mining-indicator"></div>
          <span>Active Mining</span>
        </div>
      </div>
      <style jsx>{`
        .sidebar {
          width: 260px;
          height: calc(100vh - 40px);
          margin: 20px;
          display: flex;
          flex-direction: column;
          padding: 32px 24px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 48px;
        }
        .logo {
          width: 32px;
          height: 32px;
        }
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1;
        }
        .sidebar-footer {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid var(--glass-border);
        }
        .status-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: var(--text-secondary);
        }
      `}</style>
    </aside>
  )
}
