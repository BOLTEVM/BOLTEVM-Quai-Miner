import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // Detect GPU on Windows
        const gpuResult = await execAsync('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"');
        const gpus = gpuResult.stdout
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => (
                line &&
                line.length > 0 &&
                !line.includes('Virtual Desktop') &&
                !line.includes('Remote Display')
            ));

        // Detect CPU on Windows
        const cpuResult = await execAsync('powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors | ConvertTo-Json"');

        let cpuData = null;
        try {
            const rawCpu = JSON.parse(cpuResult.stdout);
            // Handle array of processors or single processor
            const processor = Array.isArray(rawCpu) ? rawCpu[0] : rawCpu;
            cpuData = {
                name: processor.Name.trim(),
                cores: processor.NumberOfCores,
                threads: processor.NumberOfLogicalProcessors
            };
        } catch (e) {
            console.error('CPU parsing error:', e);
        }

        return NextResponse.json({ gpus, cpu: cpuData });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
