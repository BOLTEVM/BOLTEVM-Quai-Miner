import { NextResponse } from 'next/server';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

interface DepResult {
    name: string;
    required: boolean;
    ok: boolean;
    version: string | null;
    hint: string;
}

async function probe(
    name: string,
    cmd: string,
    required: boolean,
    hint: string
): Promise<DepResult> {
    try {
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        const version = stdout.split(/\r?\n/).find(l => l.trim()) ?? null;
        return { name, required, ok: true, version: version?.trim() ?? null, hint };
    } catch {
        return { name, required, ok: false, version: null, hint };
    }
}

async function checkCompiler(): Promise<DepResult> {
    const platform = process.platform;

    if (platform === 'win32') {
        const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
        if (fs.existsSync(vswhere)) {
            try {
                const out = execSync(`"${vswhere}" -latest -property displayName`, { encoding: 'utf8' }).trim();
                if (out) return {
                    name: 'Visual Studio (MSVC)',
                    required: true,
                    ok: true,
                    version: out,
                    hint: 'Required for CMake MSVC generator.',
                };
            } catch {}
        }
        return {
            name: 'Visual Studio (MSVC)',
            required: true,
            ok: false,
            version: null,
            hint: 'Install VS 2017-2022 with "Desktop development with C++".',
        };
    } else {
        // Assume Linux/Unix
        return await probe(
            'GCC/G++',
            'g++ --version',
            true,
            'Required for compilation. Install build-essential (Debian/Ubuntu) or base-devel (Arch).'
        );
    }
}

export async function GET() {
    const platform = process.platform;
    
    // Core Dependencies
    const [cmake, git, compiler] = await Promise.all([
        probe('CMake', 'cmake --version', true, 'Install via your package manager (apt install cmake).'),
        probe('Git', 'git --version', true, 'Install via your package manager (apt install git).'),
        checkCompiler(),
    ]);

    const deps: DepResult[] = [cmake, git, compiler];

    if (platform === 'win32') {
        const perl = await probe(
            'Perl',
            'perl -v',
            true,
            'Required for OpenSSL. Install Strawberry Perl.'
        );
        deps.push(perl);
    } else {
        const make = await probe('Make', 'make --version', true, 'Install build-essential.');
        // L-10 FIX: --modversion returns the actual library version string instead of silent exit
        const ssl = await probe('OpenSSL Headers', 'pkg-config --modversion openssl', true, 'Install libssl-dev or openssl-devel.');
        deps.push(make, ssl);
    }

    const allOk = deps.filter(d => d.required).every(d => d.ok);

    return NextResponse.json({ ok: allOk, deps });
}
