declare module 'peer' {
  import { EventEmitter } from 'events';

  export interface PeerServerConfig {
    port?: number;
    path?: string;
    key?: string;
    proxied?: boolean;
  }

  export interface Client {
    getId(): string;
  }

  export interface PeerServer extends EventEmitter {
    on(event: 'connection', listener: (client: Client) => void): this;
    on(event: 'disconnect', listener: (client: Client) => void): this;
    close(): void;
  }

  export function PeerServer(options?: PeerServerConfig): PeerServer;
} 