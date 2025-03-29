import { PeerServer, Client } from 'peer';

export interface PeerServerConfig {
  port?: number;
  path?: string;
  key?: string;
  proxied?: boolean;
}

export class WebRTCServer {
  private server: ReturnType<typeof PeerServer> | null = null;
  private readonly config: PeerServerConfig;

  constructor(config: PeerServerConfig = {}) {
    this.config = {
      port: 9000,
      path: '/myapp',
      key: 'peerjs',
      ...config
    };
  }

  start(): void {
    if (this.server) {
      throw new Error('Server is already running');
    }

    this.server = PeerServer({
      port: this.config.port,
      path: this.config.path,
      key: this.config.key,
      proxied: this.config.proxied
    });

    this.server.on('connection', (client: Client) => {
      console.log(`Client connected: ${client.getId()}`);
    });

    this.server.on('disconnect', (client: Client) => {
      console.log(`Client disconnected: ${client.getId()}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getAddress(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    return `http://localhost:${this.config.port}${this.config.path}`;
  }
}

export default WebRTCServer; 