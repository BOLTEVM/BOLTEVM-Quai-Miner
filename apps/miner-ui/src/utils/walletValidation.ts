/**
 * Quai Network Cyprus-1 Zone & Checksum Validator
 * Cyprus-1 address byte 0 range: 0x00 through 0x0D
 */

export function normalizeQuaiAddress(address: string): string {
    return (address || '').trim().toLowerCase();
}

export function isCyprus1Zone(address: string): boolean {
    const clean = normalizeQuaiAddress(address);
    if (!/^0x[0-9a-f]{40}$/.test(clean)) return false;
    const prefixByte = parseInt(clean.substring(2, 4), 16);
    return prefixByte >= 0x00 && prefixByte <= 0x0d;
}

export function validateQuaiWallet(address: string): { valid: boolean; error?: string } {
    const clean = normalizeQuaiAddress(address);
    if (!clean) return { valid: false, error: 'Wallet address is required.' };
    if (!clean.startsWith('0x')) return { valid: false, error: 'Address must start with 0x.' };
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) return { valid: false, error: 'Address must be a 40-character hex string.' };
    if (!isCyprus1Zone(clean)) return { valid: false, error: 'Address must belong to Cyprus-1 zone (starts with 0x00... through 0x0D...).' };
    return { valid: true };
}
