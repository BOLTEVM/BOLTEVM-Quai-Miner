'use client';

import { useState } from 'react';
import { Terminal, Cpu, Database, Server, ExternalLink, HardDrive, TerminalSquare, Info } from 'lucide-react';

export default function MinerInstructions() {
  const [os, setOs] = useState<'windows' | 'linux'>('windows');

  return (
    <div className="instructions-container animate-fade-in">
      <div className="section-header">
        <Server size={20} color="var(--accent-cyan)" />
        <h3>Professional Miner: Official Build Guide</h3>
        <div className="os-toggle">
          <button className={os === 'windows' ? 'active' : ''} onClick={() => setOs('windows')}>Windows</button>
          <button className={os === 'linux' ? 'active' : ''} onClick={() => setOs('linux')}>Linux</button>
        </div>
      </div>

      <div className="instructions-grid">
        <div className="glass-card instruction-card">
          <div className="card-top">
            <HardDrive size={24} />
            <div>
              <h4>1. Requirements</h4>
              <p>Prepare your environment.</p>
            </div>
          </div>
          <ul className="requirements-list">
            <li><strong>CMake</strong> &gt;= 3.5</li>
            <li><strong>Git</strong> & <strong>Perl</strong> (for OpenSSL)</li>
            {os === 'windows' ? (
              <>
                <li><strong>Visual Studio 2017+</strong></li>
                <li><strong>MSVC 2015 toolkit</strong> (v140)</li>
              </>
            ) : (
              <>
                <li><strong>GCC</strong> &gt;= 4.8</li>
                <li><strong>libdbus-1-dev</strong> (Ubuntu)</li>
              </>
            )}
            <li><strong>CUDA Toolkit</strong> &gt;= 9.0 (Optional)</li>
          </ul>
        </div>

        <div className="glass-card instruction-card">
          <div className="card-top">
            <Cpu size={24} />
            <div>
              <h4>2. Configure & Build</h4>
              <p>Compile the binary from source.</p>
            </div>
          </div>
          <div className="code-block">
            <code>
              git submodule update --init --recursive<br />
              mkdir build && cd build<br />
              {os === 'windows' ? (
                <>cmake .. -G "Visual Studio 15 2017 Win64" -T v140<br />cmake --build . --config Release</>
              ) : (
                <>cmake ..<br />cmake --build .</>
              )}
            </code>
          </div>
        </div>

        <div className="glass-card instruction-card full-width">
          <div className="card-top">
            <TerminalSquare size={24} />
            <div>
              <h4>3. Execute with Stratum Proxy</h4>
              <p>Direct the miner to your proxy address.</p>
            </div>
          </div>
          <div className="code-block highlighted">
            <code>./quai-gpu-miner {os === 'windows' ? '-U' : '-G'} -S localhost:3333 -W worker1 --account 0x004d...d906</code>
          </div>
          <div className="tech-notes">
            <div className="note-item"><Info size={14} /> <span>Use <strong>-U</strong> for NVIDIA (CUDA) or <strong>-G</strong> for AMD (OpenCL)</span></div>
            <div className="payout-note">Linking to: 0x004d3530737b741025A7875eAA7A7D1E5a54d906</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .instructions-container { margin-top: 32px; padding-bottom: 40px; }
        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .section-header h3 { font-size: 18px; color: var(--text-primary); margin: 0; }
        .os-toggle { margin-left: auto; display: flex; background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 4px; border: 1px solid var(--glass-border); }
        .os-toggle button { padding: 6px 16px; border: none; background: transparent; color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }
        .os-toggle button.active { background: var(--accent-cyan); color: #000; box-shadow: 0 0 10px rgba(0, 242, 255, 0.3); }
        
        .instructions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .instruction-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; transition: border-color 0.3s ease; }
        .instruction-card:hover { border-color: rgba(0, 242, 255, 0.2); }
        .instruction-card.full-width { grid-column: span 2; }
        
        .card-top { display: flex; gap: 16px; align-items: center; color: var(--accent-cyan); }
        .card-top h4 { margin: 0; color: var(--text-primary); font-size: 16px; }
        .card-top p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary); }
        
        .requirements-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-secondary); }
        .requirements-list strong { color: var(--text-primary); }
        
        .code-block { background: rgba(0, 0, 0, 0.4); padding: 16px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #eee; line-height: 1.6; }
        .highlighted { border-color: rgba(0, 242, 255, 0.3); background: rgba(0, 242, 255, 0.02); }
        
        .tech-notes { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary); padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); }
        .note-item { display: flex; align-items: center; gap: 8px; }
        .payout-note { color: var(--accent-purple); font-weight: 700; opacity: 0.9; }
        
        @media (max-width: 900px) {
          .instructions-grid { grid-template-columns: 1fr; }
          .instruction-card.full-width { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
