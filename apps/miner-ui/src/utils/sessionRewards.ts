/**
 * Persistent Session Reward Accounting Utility
 * Backed by localStorage ('bolt_session_rewards')
 */

export interface SessionRewardState {
    acceptedShares: number;
    blocksFound: number;
    sessionRewards: number;
    lastUpdated: string;
}

const STORAGE_KEY = 'bolt_session_rewards';

export function getStoredSessionRewards(): SessionRewardState {
    if (typeof window === 'undefined') {
        return { acceptedShares: 0, blocksFound: 0, sessionRewards: 0, lastUpdated: new Date().toISOString() };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                acceptedShares: parsed.acceptedShares || 0,
                blocksFound: parsed.blocksFound || 0,
                sessionRewards: parsed.sessionRewards || 0,
                lastUpdated: parsed.lastUpdated || new Date().toISOString()
            };
        }
    } catch (e) {}
    return { acceptedShares: 0, blocksFound: 0, sessionRewards: 0, lastUpdated: new Date().toISOString() };
}

export function saveSessionRewards(state: Partial<SessionRewardState>): SessionRewardState {
    const current = getStoredSessionRewards();
    const updated: SessionRewardState = {
        acceptedShares: state.acceptedShares !== undefined ? state.acceptedShares : current.acceptedShares,
        blocksFound: state.blocksFound !== undefined ? state.blocksFound : current.blocksFound,
        sessionRewards: state.sessionRewards !== undefined ? state.sessionRewards : current.sessionRewards,
        lastUpdated: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
    }
    return updated;
}

export function recordAcceptedShare(
    shareDiff: number = 0.048,
    networkDiff: number = 1000000,
    blockReward: number = 1.5
): SessionRewardState {
    const current = getStoredSessionRewards();
    const calculatedReward = (shareDiff * blockReward) / Math.max(1, networkDiff);
    return saveSessionRewards({
        acceptedShares: current.acceptedShares + 1,
        sessionRewards: current.sessionRewards + calculatedReward
    });
}

export function recordBlockFound(rewardPerBlock = 2.5): SessionRewardState {
    const current = getStoredSessionRewards();
    return saveSessionRewards({
        blocksFound: current.blocksFound + 1,
        sessionRewards: current.sessionRewards + rewardPerBlock
    });
}
