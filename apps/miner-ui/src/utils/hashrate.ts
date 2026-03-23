/**
 * Estimates hashrate based on hardware name/type.
 * GPU values are returned in GH/s, CPU values in MH/s.
 */
export function estimateHashrate(name: string, type: 'gpu' | 'cpu'): { value: number; unit: 'GH/s' | 'MH/s' } {
    const n = name.toLowerCase();

    if (type === 'gpu') {
        // RTX 30 series
        if (n.includes('3090')) return { value: 750.5, unit: 'GH/s' };
        if (n.includes('3080')) return { value: 620.2, unit: 'GH/s' };
        if (n.includes('3070')) return { value: 512.4, unit: 'GH/s' };
        if (n.includes('3060')) return { value: 410.8, unit: 'GH/s' };

        // RTX 20 series
        if (n.includes('2080')) return { value: 480.5, unit: 'GH/s' };
        if (n.includes('2070')) return { value: 450.5, unit: 'GH/s' };
        if (n.includes('2060')) return { value: 380.2, unit: 'GH/s' };

        // GTX 10 series
        if (n.includes('1080')) return { value: 320.4, unit: 'GH/s' };
        if (n.includes('1070')) return { value: 280.1, unit: 'GH/s' };
        if (n.includes('1060')) return { value: 210.5, unit: 'GH/s' };

        // Integrated / Low end
        if (n.includes('intel') || n.includes('uhd') || n.includes('iris')) return { value: 12.5, unit: 'GH/s' };
        if (n.includes('amd radeon') || n.includes('vega')) return { value: 45.2, unit: 'GH/s' };

        return { value: 225.2, unit: 'GH/s' }; // Generic fallback
    } else {
        // CPU Hashrates in MH/s
        if (n.includes('threadripper')) return { value: 85.5, unit: 'MH/s' };
        if (n.includes('ryzen 9') || n.includes('i9')) return { value: 45.2, unit: 'MH/s' };
        if (n.includes('ryzen 7') || n.includes('i7')) return { value: 32.4, unit: 'MH/s' };
        if (n.includes('ryzen 5') || n.includes('i5')) return { value: 18.2, unit: 'MH/s' };
        if (n.includes('ryzen 3') || n.includes('i3')) return { value: 8.5, unit: 'MH/s' };

        return { value: 12.2, unit: 'MH/s' }; // Generic fallback
    }
}

/** Format a hashrate value + unit into a display string. */
export function formatHashrate(val: number, unit: string): string {
    return `${val.toFixed(1)} ${unit}`;
}

/**
 * Normalises any hashrate value to MH/s for arithmetic summation.
 * GPU estimates are in GH/s → multiply by 1000 to get MH/s.
 * CPU estimates are already in MH/s.
 */
export function convertToMHs(value: number, unit: 'GH/s' | 'MH/s' | string): number {
    return unit === 'GH/s' ? value * 1000 : value;
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
