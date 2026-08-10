/**
 * Persistent Dual-Bucket Session Reward Accounting Utility
 * Backed by localStorage ('bolt_session_rewards')
 */

export interface SessionRewardState {
    validShares: number;
    staleShares: number;
    validSessionRewards: number;
    staleSessionRewards: number;
    acceptedShares: number; // Sum of validShares + staleShares
    blocksFound: number;
    sessionRewards: number; // Valid rewards
    lastUpdated: string;
}

const STORAGE_KEY = 'bolt_session_rewards';

export function getStoredSessionRewards(): SessionRewardState {
    if (typeof window === 'undefined') {
        return {
            validShares: 0,
            staleShares: 0,
            validSessionRewards: 0,
            staleSessionRewards: 0,
            acceptedShares: 0,
            blocksFound: 0,
            sessionRewards: 0,
            lastUpdated: new Date().toISOString()
        };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const validShares = typeof parsed.validShares === 'number' ? parsed.validShares : (parsed.acceptedShares || 0);
            const staleShares = typeof parsed.staleShares === 'number' ? parsed.staleShares : 0;
            const validSessionRewards = typeof parsed.validSessionRewards === 'number' ? parsed.validSessionRewards : (parsed.sessionRewards || 0);
            const staleSessionRewards = typeof parsed.staleSessionRewards === 'number' ? parsed.staleSessionRewards : 0;

            return {
                validShares,
                staleShares,
                validSessionRewards,
                staleSessionRewards,
                acceptedShares: validShares + staleShares,
                blocksFound: parsed.blocksFound || 0,
                sessionRewards: validSessionRewards,
                lastUpdated: parsed.lastUpdated || new Date().toISOString()
            };
        }
    } catch (e) {}
    return {
        validShares: 0,
        staleShares: 0,
        validSessionRewards: 0,
        staleSessionRewards: 0,
        acceptedShares: 0,
        blocksFound: 0,
        sessionRewards: 0,
        lastUpdated: new Date().toISOString()
    };
}

export function saveSessionRewards(state: Partial<SessionRewardState>): SessionRewardState {
    const current = getStoredSessionRewards();
    const validShares = state.validShares !== undefined ? state.validShares : current.validShares;
    const staleShares = state.staleShares !== undefined ? state.staleShares : current.staleShares;
    const validSessionRewards = state.validSessionRewards !== undefined ? state.validSessionRewards : current.validSessionRewards;
    const staleSessionRewards = state.staleSessionRewards !== undefined ? state.staleSessionRewards : current.staleSessionRewards;

    const updated: SessionRewardState = {
        validShares,
        staleShares,
        validSessionRewards,
        staleSessionRewards,
        acceptedShares: validShares + staleShares,
        blocksFound: state.blocksFound !== undefined ? state.blocksFound : current.blocksFound,
        sessionRewards: validSessionRewards,
        lastUpdated: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
    }
    return updated;
}

export function recordAcceptedShare(isStale: boolean = false, rewardPerShare: number = 0.05): SessionRewardState {
    const current = getStoredSessionRewards();
    if (isStale) {
        return saveSessionRewards({
            staleShares: current.staleShares + 1
        });
    }
    return saveSessionRewards({
        validShares: current.validShares + 1,
        validSessionRewards: current.validSessionRewards + rewardPerShare
    });
}

export function purgeStaleShares(): SessionRewardState {
    const current = getStoredSessionRewards();
    return saveSessionRewards({
        staleShares: 0,
        staleSessionRewards: 0
    });
}

export function recordBlockFound(rewardPerBlock = 2.5): SessionRewardState {
    const current = getStoredSessionRewards();
    return saveSessionRewards({
        blocksFound: current.blocksFound + 1,
        validSessionRewards: current.validSessionRewards + rewardPerBlock
    });
}
