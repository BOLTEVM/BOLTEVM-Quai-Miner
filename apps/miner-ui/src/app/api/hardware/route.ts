import { NextResponse } from 'next/server';

import { execSync } from 'child_process';

export async function GET() {
    let gpus = [];
    let cpu = { name: 'Unknown CPU', cores: 0, threads: 0 };

    try {
        if (process.platform === 'win32') {
            // Fetch genuine Windows GPU and CPU metrics
            const gpuOut = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"').toString();
            gpus = gpuOut.trim().split('\n').map(l => l.trim()).filter(l => l !== '');

            const cpuOut = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors | ConvertTo-Json"').toString();
            const cpuData = JSON.parse(cpuOut);
            cpu.name = cpuData.Name || 'Unknown CPU';
            cpu.cores = cpuData.NumberOfCores || 0;
            cpu.threads = cpuData.NumberOfLogicalProcessors || 0;
        } else {
            // Linux fallback sequence
            try {
                const nvidiaOut = execSync('nvidia-smi -L').toString();
                gpus = nvidiaOut.trim().split('\n').map(l => l.split(':')[1]?.trim() || l).filter(Boolean);
            } catch {
                const lspciOut = execSync('lspci | grep -iE "vga|3d|display"').toString();
                gpus = lspciOut.trim().split('\n').map(l => l.substring(l.indexOf(':') + 1).trim()).filter(Boolean);
            }
            // Basic Linux CPU parsing
            const lscpuOut = execSync('lscpu').toString();
            const nameMatch = lscpuOut.match(/Model name:\s+(.+)/i);
            const coreMatch = lscpuOut.match(/Core\(s\) per socket:\s+(\d+)/i);
            const threadMatch = lscpuOut.match(/Thread\(s\) per core:\s+(\d+)/i);
            
            cpu.name = nameMatch ? nameMatch[1].trim() : 'Linux CPU';
            const coresPerSocket = coreMatch ? parseInt(coreMatch[1]) : 4;
            const threadsPerCore = threadMatch ? parseInt(threadMatch[1]) : 2;
            cpu.cores = coresPerSocket;
            cpu.threads = coresPerSocket * threadsPerCore;
        }
    } catch (e) {
        console.error("Hardware native detection failed: ", e);
    }

    return NextResponse.json({
        gpus: gpus,
        cpu: cpu
    });
}
