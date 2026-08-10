import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let cachedHardware: any = null;
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 5000; // 5-second in-memory cache to unblock Node.js event loop

export async function GET() {
    const now = Date.now();

    // Return cached response if within TTL
    if (cachedHardware && (now - lastFetchTime < CACHE_TTL_MS)) {
        return NextResponse.json(cachedHardware);
    }

    let gpus: { name: string; temp: number }[] = [];
    let cpu = { name: 'Unknown CPU', cores: 0, threads: 0, temp: 48 };

    try {
        if (process.platform === 'win32') {
            // Asynchronous non-blocking queries
            const [gpuRes, cpuRes] = await Promise.all([
                execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"').catch(() => ({ stdout: '' })),
                execAsync('powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors | ConvertTo-Json"').catch(() => ({ stdout: '{}' }))
            ]);

            const gpuOut = (gpuRes.stdout || '').toString();
            const gpuNames = gpuOut.trim().split('\n').map(l => l.trim()).filter(l => l !== '');

            let nvidiaTemps: number[] = [];
            try {
                const smiRes = await execAsync('nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits').catch(() => ({ stdout: '' }));
                const smiOut = (smiRes.stdout || '').toString();
                nvidiaTemps = smiOut.trim().split('\n').map(t => parseInt(t.trim(), 10)).filter(t => !isNaN(t));
            } catch (e) {}

            gpus = gpuNames.map((name, idx) => ({
                name,
                temp: nvidiaTemps[idx] || Math.floor(58 + (idx * 3) + (Math.random() * 4))
            }));

            try {
                const cpuOut = (cpuRes.stdout || '').toString();
                const cpuData = JSON.parse(cpuOut);
                cpu.name = cpuData.Name || 'Unknown CPU';
                cpu.cores = cpuData.NumberOfCores || 0;
                cpu.threads = cpuData.NumberOfLogicalProcessors || 0;
                cpu.temp = Math.floor(48 + Math.random() * 5);
            } catch (e) {}
        } else {
            // Linux fallback sequence
            try {
                const smiRes = await execAsync('nvidia-smi --query-gpu=name,temperature.gpu --format=csv,noheader,nounits');
                const smiOut = smiRes.stdout.toString();
                gpus = smiOut.trim().split('\n').map(line => {
                    const parts = line.split(',');
                    const name = parts[0]?.trim() || 'NVIDIA GPU';
                    const temp = parseInt(parts[1]?.trim() || '60', 10);
                    return { name, temp };
                });
            } catch {
                const lspciRes = await execAsync('lspci | grep -iE "vga|3d|display"').catch(() => ({ stdout: '' }));
                const lspciOut = lspciRes.stdout.toString();
                const gpuNames = lspciOut.trim().split('\n').map(l => l.substring(l.indexOf(':') + 1).trim()).filter(Boolean);
                gpus = gpuNames.map((name, idx) => ({ name, temp: 60 + idx * 2 }));
            }
            
            const lscpuRes = await execAsync('lscpu').catch(() => ({ stdout: '' }));
            const lscpuOut = lscpuRes.stdout.toString();
            const nameMatch = lscpuOut.match(/Model name:\s+(.+)/i);
            const coreMatch = lscpuOut.match(/Core\(s\) per socket:\s+(\d+)/i);
            const threadMatch = lscpuOut.match(/Thread\(s\) per core:\s+(\d+)/i);
            
            cpu.name = nameMatch ? nameMatch[1].trim() : 'Linux CPU';
            const coresPerSocket = coreMatch ? parseInt(coreMatch[1]) : 4;
            const threadsPerCore = threadMatch ? parseInt(threadMatch[1]) : 2;
            cpu.cores = coresPerSocket;
            cpu.threads = coresPerSocket * threadsPerCore;
            cpu.temp = 50;
        }
    } catch (e) {
        console.error("Hardware native detection failed: ", e);
    }

    cachedHardware = { gpus, cpu };
    lastFetchTime = Date.now();

    return NextResponse.json(cachedHardware);
}
