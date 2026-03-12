'use client';

import Sidebar from '../../components/Sidebar'
import MinerTable from '../../components/MinerTable'
import { Plus } from 'lucide-react'

export default function MinersPage() {
    return (
        <div className="page-container">
            <Sidebar />
            <main className="main-content">
                <header className="page-header">
                    <div>
                        <h1>Miner Management</h1>
                        <p>Monitor and control your mining hardware performance.</p>
                    </div>
                    <button className="btn-primary flex-items">
                        <Plus size={20} />
                        <span>Add Worker</span>
                    </button>
                </header>

                <MinerTable />
            </main>

            <style jsx>{`
        .page-container {
          display: flex;
          min-height: 100vh;
        }
        .main-content {
          flex: 1;
          padding: 48px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .page-header h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .page-header p {
          color: var(--text-secondary);
        }
        .flex-items {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
        </div>
    )
}
