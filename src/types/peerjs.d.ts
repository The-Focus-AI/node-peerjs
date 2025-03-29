declare module 'peerjs' {
  import { EventEmitter } from 'events';

  export interface PeerConfig {
    host?: string;
    port?: number;
    path?: string;
    secure?: boolean;
    debug?: number;
    config?: RTCConfiguration & {
      wrtc?: {
        RTCPeerConnection: any;
      };
    };
  }

  export interface DataConnection {
    on(event: 'data', callback: (data: any) => void): void;
    on(event: 'open', callback: () => void): void;
    on(event: 'close', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    send(data: any): void;
    close(): void;
  }

  export interface PeerError<T extends string> extends Error {
    type: T;
  }

  export interface PeerEvents {
    open: (id: string) => void;
    connection: (connection: DataConnection) => void;
    disconnected: () => void;
    close: () => void;
    error: (error: PeerError<string>) => void;
  }

  export class Peer {
    constructor(id?: string, options?: PeerConfig);
    constructor(options?: PeerConfig);

    id: string;
    disconnected: boolean;
    destroyed: boolean;

    on<T extends keyof PeerEvents>(event: T, callback: PeerEvents[T]): void;
    connect(peerId: string): DataConnection;
    disconnect(): void;
    destroy(): void;
    emit<T extends keyof PeerEvents>(event: T, ...args: Parameters<PeerEvents[T]>): void;
  }
} 