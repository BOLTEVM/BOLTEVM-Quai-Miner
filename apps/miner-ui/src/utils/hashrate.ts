/**
 * Hashrate estimation for KawPow algorithm (Quai Network).
 * All values are in MH/s — consistent with actual quai-gpu-miner telemetry output.
 */
export function estimateHashrate(name: string, type: 'gpu' | 'cpu'): { value: number; unit: 'MH/s' } {
    const n = name.toLowerCase();

    if (type === 'gpu') {
        // RTX 40 series (KawPow MH/s estimates)
        if (n.includes('4090')) return { value: 62.0, unit: 'MH/s' };
        if (n.includes('4080')) return { value: 48.0, unit: 'MH/s' };
        if (n.includes('4070')) return { value: 36.0, unit: 'MH/s' };
        if (n.includes('4060')) return { value: 24.0, unit: 'MH/s' };

        // RTX 30 series
        if (n.includes('3090')) return { value: 33.0, unit: 'MH/s' };
        if (n.includes('3080')) return { value: 27.0, unit: 'MH/s' };
        if (n.includes('3070')) return { value: 16.5, unit: 'MH/s' };
        if (n.includes('3060')) return { value: 12.5, unit: 'MH/s' };

        // RTX 20 series
        if (n.includes('2080')) return { value: 18.0, unit: 'MH/s' };
        if (n.includes('2070')) return { value: 15.5, unit: 'MH/s' };
        if (n.includes('2060')) return { value: 10.5, unit: 'MH/s' };

        // GTX 16 series
        if (n.includes('1660')) return { value: 8.5,  unit: 'MH/s' };

        // GTX 10 series
        if (n.includes('1080')) return { value: 8.0,  unit: 'MH/s' };
        if (n.includes('1070')) return { value: 5.5,  unit: 'MH/s' };
        if (n.includes('1060')) return { value: 3.5,  unit: 'MH/s' };

        // AMD RX 6000 series
        if (n.includes('rx 6900') || n.includes('rx6900')) return { value: 28.0, unit: 'MH/s' };
        if (n.includes('rx 6800') || n.includes('rx6800')) return { value: 22.0, unit: 'MH/s' };
        if (n.includes('rx 6700') || n.includes('rx6700')) return { value: 18.0, unit: 'MH/s' };
        if (n.includes('rx 6600') || n.includes('rx6600')) return { value: 14.0, unit: 'MH/s' };

        // Integrated / Low-end
        if (n.includes('intel') || n.includes('uhd') || n.includes('iris')) return { value: 0.5, unit: 'MH/s' };
        if (n.includes('amd radeon') || n.includes('vega'))                  return { value: 4.0, unit: 'MH/s' };

        return { value: 10.0, unit: 'MH/s' }; // Generic fallback

    } else {
        // CPU Hashrates in MH/s (KawPow is GPU-optimized; CPU rates are very low)
        if (n.includes('threadripper')) return { value: 0.85, unit: 'MH/s' };
        if (n.includes('ryzen 9') || n.includes('i9')) return { value: 0.45, unit: 'MH/s' };
        if (n.includes('ryzen 7') || n.includes('i7')) return { value: 0.32, unit: 'MH/s' };
        if (n.includes('ryzen 5') || n.includes('i5')) return { value: 0.18, unit: 'MH/s' };
        if (n.includes('ryzen 3') || n.includes('i3')) return { value: 0.08, unit: 'MH/s' };

        return { value: 0.12, unit: 'MH/s' }; // Generic fallback
    }
}

/** Format a hashrate value + unit into a display string. */
export function formatHashrate(val: number, unit: string): string {
    return `${val.toFixed(1)} ${unit}`;
}

/**
 * Normalises any hashrate value to MH/s for arithmetic summation.
 * All estimates are now in MH/s, so this is a simple passthrough.
 * Kept for backwards compatibility with any code still passing 'GH/s'.
 */
export function convertToMHs(value: number, unit: 'GH/s' | 'MH/s' | string): number {
    if (unit === 'GH/s') return value * 1000;
    if (unit === 'TH/s') return value * 1_000_000;
    return value; // Already MH/s
}

/**
 * Converts a total MH/s figure to a human-readable string,
 * automatically choosing GH/s or MH/s based on magnitude.
 */
export function formatMHsTotal(totalMHs: number): string {
    if (totalMHs >= 1000) return `${(totalMHs / 1000).toFixed(1)} GH/s`;
    return `${totalMHs.toFixed(1)} MH/s`;
}

// ---------------------------------------------------------------------------
// Backwards-compat alias — prefer convertToMHs in new code
// ---------------------------------------------------------------------------
/** @deprecated Use convertToMHs instead */
export const convertToStandardUnit = convertToMHs;
