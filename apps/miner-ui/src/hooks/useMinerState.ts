'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GPUItem {
  name: string;
  temp?: number;
}

export interface CPUItem {
  name: string;
  cores: number;
  threads: number;
  temp?: number;
}

export interface CustomWorker {
  id: string;
  type: string;
  hardwareCategory: 'gpu' | 'cpu' | 'remote';
  hashrate: string;
  numericHashrate: number;
  status: 'Online' | 'Rebooting' | 'Paused' | 'Error' | 'Offline';
  temp?: string | number;
}

export interface MinerState {
  active: boolean;
  mode: 'gpu' | 'cpu' | 'dual';
  wallet: string;
  stratum: string;
  selectedPool: string;
  network: string;
  profile: string;
  intensity: string;
  gpus: GPUItem[];
  cpu: CPUItem | null;
  customWorkers: CustomWorker[];
}

export const DEFAULT_MINER_STATE: MinerState = {
  active: true,
  mode: 'dual',
  wallet: '0x001598ce5966385c9290b1b87079f1be620cf2a2',
  stratum: 'stratum+tcp://quai-kawpow.kryptex.network:7043',
  selectedPool: 'kryptex',
  network: 'Cyprus-1 (Colosseum Testnet)',
  profile: 'balanced',
  intensity: 'Medium (Standard)',
  gpus: [{ name: 'NVIDIA GeForce RTX 2070', temp: 62 }],
  cpu: { name: 'Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz', cores: 6, threads: 12, temp: 48 },
  customWorkers: []
};

const STORAGE_KEY = 'miner_state';

export function useMinerState() {
  const [state, setState] = useState<MinerState>(DEFAULT_MINER_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Read initial state from localStorage
  const loadState = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setState({
            active: typeof parsed.active === 'boolean' ? parsed.active : DEFAULT_MINER_STATE.active,
            mode: parsed.mode || DEFAULT_MINER_STATE.mode,
            wallet: parsed.wallet || DEFAULT_MINER_STATE.wallet,
            stratum: parsed.stratum || DEFAULT_MINER_STATE.stratum,
            selectedPool: parsed.selectedPool || DEFAULT_MINER_STATE.selectedPool,
            network: parsed.network || DEFAULT_MINER_STATE.network,
            profile: parsed.profile || DEFAULT_MINER_STATE.profile,
            intensity: parsed.intensity || DEFAULT_MINER_STATE.intensity,
            gpus: Array.isArray(parsed.gpus) ? parsed.gpus : DEFAULT_MINER_STATE.gpus,
            cpu: parsed.cpu || DEFAULT_MINER_STATE.cpu,
            customWorkers: Array.isArray(parsed.customWorkers) ? parsed.customWorkers : DEFAULT_MINER_STATE.customWorkers
          });
        }
      }
    } catch (e) {
      console.error('Failed to load miner_state from localStorage:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadState();

    // Cross-tab state synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadState]);

  // Persist updated state to localStorage and broadcast change event
  const saveState = useCallback((newState: MinerState) => {
    setState(newState);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        window.dispatchEvent(new Event('miner_state_updated'));
      } catch (e) {
        console.error('Failed to save miner_state:', e);
      }
    }
  }, []);

  const updateState = useCallback((partial: Partial<MinerState>) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event('miner_state_updated'));
        } catch (e) {}
      }
      return next;
    });
  }, []);

  const addCustomWorker = useCallback((worker: CustomWorker) => {
    setState(prev => {
      const updatedWorkers = [...prev.customWorkers.filter(w => w.id !== worker.id), worker];
      const next = { ...prev, customWorkers: updatedWorkers };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event('miner_state_updated'));
        } catch (e) {}
      }
      return next;
    });
  }, []);

  const removeCustomWorker = useCallback((workerId: string) => {
    setState(prev => {
      const updatedWorkers = prev.customWorkers.filter(w => w.id !== workerId);
      const next = { ...prev, customWorkers: updatedWorkers };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event('miner_state_updated'));
        } catch (e) {}
      }
      return next;
    });
  }, []);

  const toggleWorkerStatus = useCallback((workerId: string, status?: CustomWorker['status']) => {
    setState(prev => {
      const updatedWorkers = prev.customWorkers.map(w => {
        if (w.id === workerId) {
          const nextStatus = status || (w.status === 'Online' ? 'Paused' : 'Online');
          return { ...w, status: nextStatus };
        }
        return w;
      });
      const next = { ...prev, customWorkers: updatedWorkers };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event('miner_state_updated'));
        } catch (e) {}
      }
      return next;
    });
  }, []);

  return {
    state,
    isLoaded,
    saveState,
    updateState,
    addCustomWorker,
    removeCustomWorker,
    toggleWorkerStatus
  };
}
