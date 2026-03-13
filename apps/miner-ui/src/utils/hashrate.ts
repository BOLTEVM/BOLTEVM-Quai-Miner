/**
 * Estimates hashrate based on hardware name/type.
 * These are rough estimations for UI/UX purposes in the Quai Network context.
 */
export function estimateHashrate(name: string, type: 'gpu' | 'cpu'): { value: number, unit: string } {
    const lowerName = name.toLowerCase();

    if (type === 'gpu') {
        // RTX 30 series
        if (lowerName.includes('3090')) return { value: 750.5, unit: 'GH/s' };
        if (lowerName.includes('3080')) return { value: 620.2, unit: 'GH/s' };
        if (lowerName.includes('3070')) return { value: 512.4, unit: 'GH/s' };
        if (lowerName.includes('3060')) return { value: 410.8, unit: 'GH/s' };

        // RTX 20 series
        if (lowerName.includes('2080')) return { value: 480.5, unit: 'GH/s' };
        if (lowerName.includes('2070')) return { value: 450.5, unit: 'GH/s' };
        if (lowerName.includes('2060')) return { value: 380.2, unit: 'GH/s' };

        // GTX 10 series
        if (lowerName.includes('1080')) return { value: 320.4, unit: 'GH/s' };
        if (lowerName.includes('1070')) return { value: 280.1, unit: 'GH/s' };
        if (lowerName.includes('1060')) return { value: 210.5, unit: 'GH/s' };

        // Integrated / Low end
        if (lowerName.includes('intel') || lowerName.includes('uhd') || lowerName.includes('iris')) {
            return { value: 12.5, unit: 'GH/s' };
        }
        if (lowerName.includes('amd radeon') || lowerName.includes('vega')) {
            return { value: 45.2, unit: 'GH/s' };
        }

        return { value: 225.2, unit: 'GH/s' }; // Fallback
    } else {
        // CPU Hashrates (MH/s)
        if (lowerName.includes('threadripper')) return { value: 85.5, unit: 'MH/s' };
        if (lowerName.includes('ryzen 9') || lowerName.includes('i9')) return { value: 45.2, unit: 'MH/s' };
        if (lowerName.includes('ryzen 7') || lowerName.includes('i7')) return { value: 32.4, unit: 'MH/s' };
        if (lowerName.includes('ryzen 5') || lowerName.includes('i5')) return { value: 18.2, unit: 'MH/s' };
        if (lowerName.includes('ryzen 3') || lowerName.includes('i3')) return { value: 8.5, unit: 'MH/s' };

        return { value: 12.2, unit: 'MH/s' }; // Fallback
    }
}

export function formatHashrate(val: number, unit: string): string {
    return `${val.toFixed(1)} ${unit}`;
}

export function convertToStandardUnit(val: number, unit: string): number {
    // Treat GH/s as 1000x MH/s for summation purposes in the UI
    if (unit === 'GH/s') return val * 1000;
    return val;
}
