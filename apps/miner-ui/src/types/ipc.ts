// IPC Protocol Definition for Local Named Pipe / Socket Communication

export interface JSONRPCRequest<T = any> {
  jsonrpc: '2.0';
  method: string;
  params: T;
  id: number | string;
}

export interface JSONRPCResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

export type MinerIPCMethod = 
  | 'miner_start'
  | 'miner_stop'
  | 'miner_reboot'
  | 'miner_getStats'
  | 'miner_getHardware'
  | 'miner_validatePool';

export interface MinerIPCMessage {
  type: 'PROGRESS' | 'SHARE_ACCEPTED' | 'FOUND_BLOCK' | 'POOL_OFFLINE' | 'POOL_OUT_OF_SYNC' | 'LOG' | 'ERROR';
  hashrate?: number;
  hashes?: number;
  lastHash?: string | null;
  proof?: string;
  nonce?: string;
  poolBlock?: number;
  chainBlock?: number;
  drift?: number;
  message?: string;
  logType?: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string;
}
