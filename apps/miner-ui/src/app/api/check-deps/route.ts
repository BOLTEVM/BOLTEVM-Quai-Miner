import { NextResponse } from 'next/server';

import { execSync } from 'child_process';

const checkBinary = (cmd, trueRegex) => {
    try {
        const out = execSync(cmd, { stdio: 'pipe' }).toString();
        const match = out.match(trueRegex);
        return { ok: true, version: match ? match[1] : 'Unknown' };
    } catch (e) {
        return { ok: false, version: null };
    }
}

export async function GET() {
    const cmakeInfo = checkBinary('cmake --version', /cmake version ([\d.]+)/);
    const gitInfo = checkBinary('git --version', /git version ([\d.]+)/);
    
    let compilerInfo = { ok: false, version: null };
    if (process.platform === 'win32') {
        compilerInfo = checkBinary('"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property catalog_productDisplayVersion', /([\d.]+)/);
        if (compilerInfo.ok) compilerInfo.version = `MSVC ${compilerInfo.version}`;
        if (!compilerInfo.ok) compilerInfo.version = 'Missing MSVC Build Tools';
    } else {
        compilerInfo = checkBinary('g++ --version', /g\+\+ \(.*\) ([\d.]+)/);
    }

    const deps = [
        { name: 'CMake', required: true, ok: cmakeInfo.ok, version: cmakeInfo.version, hint: 'Required to build native codebase' },
        { name: 'Git', required: true, ok: gitInfo.ok, version: gitInfo.version, hint: 'Required to fetch submodule' },
        { name: 'C++ Compiler', required: true, ok: compilerInfo.ok, version: compilerInfo.version, hint: 'Required MSVC or GCC' }
    ];

    const allOk = deps.every(d => !d.required || d.ok);

    return NextResponse.json({
        deps,
        ok: allOk
    });
}
