import { NextResponse } from 'next/server';
import { exec } from 'child_process';
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
        // Grab first non-empty line as the version string
        const version = stdout.split(/\r?\n/).find(l => l.trim()) ?? null;
        return { name, required, ok: true, version: version?.trim() ?? null, hint };
    } catch {
        return { name, required, ok: false, version: null, hint };
    }
}

function checkVS(): DepResult {
    const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
    const paths2022 = [
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools',
    ];
    const paths2019 = [
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
    ];
    const paths2017 = [
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Professional',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\BuildTools',
    ];

    // Prefer vswhere for accurate detection
    if (fs.existsSync(vswhere)) {
        try {
            const { execSync } = require('child_process');
            const out = execSync(`"${vswhere}" -latest -property displayName`, { encoding: 'utf8' }).trim();
            if (out) return {
                name: 'Visual Studio (MSVC)',
                required: true,
                ok: true,
                version: out,
                hint: 'Required for CMake MSVC generator. Install from visualstudio.microsoft.com',
            };
        } catch {}
    }

    // Fall back to path checks
    const found =
        [...paths2022, ...paths2019, ...paths2017].find(p => fs.existsSync(p));

    return {
        name: 'Visual Studio (MSVC)',
        required: true,
        ok: !!found,
        version: found ? found.split('\\').slice(-2).join(' ') : null,
        hint: 'Install Visual Studio 2017–2022 with "Desktop development with C++" workload.',
    };
}

export async function GET() {
    const [cmake, perl, git] = await Promise.all([
        probe(
            'CMake',
            'cmake --version',
            true,
            'Install from cmake.org or run: winget install Kitware.CMake'
        ),
        probe(
            'Perl',
            'perl -e "print $]"',
            true,
            'Required for OpenSSL build. Install Strawberry Perl: winget install StrawberryPerl.StrawberryPerl'
        ),
        probe(
            'Git',
            'git --version',
            true,
            'Install from git-scm.com or: winget install Git.Git'
        ),
    ]);

    const vs = checkVS();

    const deps: DepResult[] = [cmake, perl, git, vs];
    const allOk = deps.filter(d => d.required).every(d => d.ok);

    return NextResponse.json({ ok: allOk, deps });
}
