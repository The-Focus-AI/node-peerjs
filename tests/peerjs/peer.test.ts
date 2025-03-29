import { describe, it, expect } from 'vitest';
import { Peer } from 'peerjs';
import { RTCPeerConnection } from '@roamhq/wrtc';

describe('PeerJS in Node.js', () => {
  it('should create a peer with node-webrtc', async () => {
    const peer = new Peer({
      config: {
        wrtc: {
          RTCPeerConnection
        }
      }
    });

    // Wait for peer to be ready
    await new Promise<void>((resolve) => {
      peer.on('open', () => {
        resolve();
      });
    });

    expect(peer.id).toBeDefined();
    expect(peer.disconnected).toBe(false);
    expect(peer.destroyed).toBe(false);

    // Clean up
    peer.destroy();
  });

  it('should connect two peers and exchange data', async () => {
    // Create peers
    const peer1 = new Peer({
      config: {
        wrtc: {
          RTCPeerConnection
        }
      }
    });

    const peer2 = new Peer({
      config: {
        wrtc: {
          RTCPeerConnection
        }
      }
    });

    // Wait for both peers to be ready
    await Promise.all([
      new Promise<void>((resolve) => peer1.on('open', () => resolve())),
      new Promise<void>((resolve) => peer2.on('open', () => resolve()))
    ]);

    // Test data exchange
    const testMessage = 'Hello from Node.js!';
    let receivedMessage: string | undefined;

    // Set up connection
    const conn = peer1.connect(peer2.id);
    
    await new Promise<void>((resolve, reject) => {
      // Handle connection on peer2
      peer2.on('connection', (connection) => {
        connection.on('data', (data) => {
          receivedMessage = data as string;
          resolve();
        });
      });

      // Send data when connection is ready
      conn.on('open', () => {
        conn.send(testMessage);
      });

      // Handle potential errors
      conn.on('error', reject);
      peer1.on('error', reject);
      peer2.on('error', reject);

      // Timeout after 5s
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    expect(receivedMessage).toBe(testMessage);

    // Clean up
    peer1.destroy();
    peer2.destroy();
  });
}); 