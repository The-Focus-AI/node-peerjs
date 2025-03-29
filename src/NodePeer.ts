// Import PeerJS as CommonJS module
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from '@roamhq/wrtc';
import { EventEmitter } from 'events';

// Mock browser environment - this must be done before PeerJS is used
const globalProxy = new Proxy(global, {
  set(target: any, prop: string, value: any) {
    if (prop === 'navigator' || prop === 'window' || prop === 'location') {
      Object.defineProperty(target, prop, {
        value,
        writable: true,
        configurable: true
      });
      return true;
    }
    target[prop] = value;
    return true;
  }
});

// Set up required browser globals
(globalProxy as any).window = {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  isSecureContext: true,
  RTCRtpTransceiver: {
    prototype: {
      currentDirection: null
    }
  }
};

(globalProxy as any).navigator = {
  platform: 'MacIntel',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  userAgentData: {
    brands: [
      {
        brand: 'Chromium',
        version: '122'
      }
    ]
  },
  webkitGetUserMedia: () => {}
};

(globalProxy as any).location = {
  protocol: 'https:'
};

// Set global WebRTC objects
(globalProxy as any).RTCPeerConnection = RTCPeerConnection;
(globalProxy as any).RTCSessionDescription = RTCSessionDescription;
(globalProxy as any).RTCIceCandidate = RTCIceCandidate;

// Mock webrtc-adapter
const webrtcAdapter = {
  browserDetails: {
    browser: 'chrome',
    version: 122
  }
};

// Mock require('webrtc-adapter')
(require.cache as any)[require.resolve('webrtc-adapter')] = {
  exports: webrtcAdapter
};

// Mock WebRTC support detection
const util = require('peerjs').util;
if (util) {
  util.supports = {
    data: true,
    audioVideo: true,
    reliable: true,
    binaryBlob: true,
    browser: true,
    webRTC: true
  };
}

export class NodePeer extends EventEmitter {
  private peer: Peer;
  private _id: string | null = null;

  constructor(id?: string) {
    super();
    const config = {
      host: '0.peerjs.com',
      secure: true,
      port: 443,
      debug: 3,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };

    this.peer = id ? new Peer(id, config) : new Peer(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.peer.on('open', (id: string) => {
      console.log('Peer ready with ID:', id);
      this._id = id;
      this.emit('open', id);
    });

    this.peer.on('error', (err: Error) => {
      console.error('Peer error:', err);
      this.emit('error', err);
    });

    this.peer.on('connection', (conn: DataConnection) => {
      console.log('Received connection');
      this.emit('connection', conn);
      
      conn.on('data', (data: unknown) => {
        console.log('Received:', data);
        this.emit('data', data);
      });
      
      conn.on('open', () => {
        conn.send('Hello back!');
        this.emit('open');
      });
    });
  }

  public connect(peerId: string): DataConnection {
    const conn = this.peer.connect(peerId);
    return conn;
  }

  public async cleanup(): Promise<void> {
    console.log('Starting cleanup...');
    try {
      // Immediately destroy the peer without waiting
      this.peer.destroy();
      console.log('Cleanup complete');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  public getId(): string {
    return this._id || '';
  }
} 