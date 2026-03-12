'use client';

import Sidebar from '../../components/Sidebar'
import SetupWizard from '../../components/SetupWizard'

export default function SetupPage() {
    return (
        <div className="page-container">
            <Sidebar />
            <main className="main-content">
                <header className="page-header" style={{ marginBottom: '48px' }}>
                    <div>
                        <h1>1-Click GPU Miner Setup</h1>
                        <p>Automated hardware optimization for Quai Network mining.</p>
                    </div>
                </header>

                <SetupWizard />
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
        }
      `}</style>
        </div>
    )
}
