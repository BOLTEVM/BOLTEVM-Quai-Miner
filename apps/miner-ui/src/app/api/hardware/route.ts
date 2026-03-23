import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const platform = process.platform;
        let gpus: string[] = [];
        let cpuData = null;

        if (platform === 'win32') {
            // --- WINDOWS DETECTION ---
            // GPU
            const gpuResult = await execAsync('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"');
            gpus = gpuResult.stdout
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => (
                    line &&
                    !line.includes('Virtual Desktop') &&
                    !line.includes('Remote Display')
                ));

            // CPU
            const cpuResult = await execAsync('powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors | ConvertTo-Json"');
            try {
                const rawCpu = JSON.parse(cpuResult.stdout);
                const processor = Array.isArray(rawCpu) ? rawCpu[0] : rawCpu;
                cpuData = {
                    name: processor.Name.trim(),
                    cores: processor.NumberOfCores,
                    threads: processor.NumberOfLogicalProcessors
                };
            } catch (e) {}
        } else if (platform === 'linux') {
            // --- LINUX DETECTION ---
            // GPU: Try nvidia-smi first, then fallback to lspci
            try {
                const { stdout: nvi } = await execAsync('nvidia-smi -L');
                gpus = nvi.split('\n').filter(l => l.includes('GPU ')).map(l => l.split(': ')[1].split(' (')[0].trim());
            } catch {
                try {
                    const { stdout: pci } = await execAsync("lspci | grep -iE 'vga|3d|display'");
                    gpus = pci.split('\n').filter(l => l.trim()).map(l => {
                        const parts = l.split(': ');
                        return parts.length > 1 ? parts[1].trim() : l.trim();
                    });
                } catch {}
            }

            // CPU: Use lscpu
            try {
                const { stdout: lscpu } = await execAsync('lscpu');
                const lines = lscpu.split('\n');
                const find = (key: string) => lines.find(l => l.includes(key))?.split(':')[1].trim();
                
                const name = find('Model name');
                const sockets = parseInt(find('Socket(s)') || '1');
                const coresPerSocket = parseInt(find('Core(s) per socket') || '1');
                const threadsPerCore = parseInt(find('Thread(s) per core') || '1');

                cpuData = {
                    name: name || 'Generic Linux CPU',
                    cores: sockets * coresPerSocket,
                    threads: sockets * coresPerSocket * threadsPerCore
                };
            } catch (e) {}
        } else if (platform === 'darwin') {
            // --- MACOS DETECTION (Limited) ---
            gpus = ['Apple Integrated GPU'];
            cpuData = { name: 'Apple Silicon / Intel Mac', cores: 8, threads: 8 };
        }

        return NextResponse.json({ 
            gpus: gpus.length > 0 ? gpus : ['Generic Display Device'], 
            cpu: cpuData 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
