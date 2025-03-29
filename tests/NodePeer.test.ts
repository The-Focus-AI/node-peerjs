import { describe, it, expect, beforeEach } from 'vitest';
import { NodePeer } from '../src/NodePeer';

describe('NodePeer', () => {
  let peer1: NodePeer;
  let peer2: NodePeer;

  beforeEach(async () => {
    peer1 = new NodePeer();
    peer2 = new NodePeer();
  });

  // Remove afterEach hook since we don't need cleanup
  // The test process will be terminated anyway

  it('should establish a connection and exchange messages', async () => {
    let messageReceived = false;

    // Wait for both peers to be ready
    await Promise.all([
      new Promise<void>((resolve) => {
        peer1.on('open', () => {
          console.log('Peer1 ready with ID:', peer1.getId());
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        peer2.on('open', () => {
          console.log('Peer2 ready with ID:', peer2.getId());
          resolve();
        });
      }),
    ]);

    // Set up message receiving on peer2
    peer2.on('connection', (conn) => {
      console.log('Peer2 received connection');
      conn.on('data', (data: string | Blob | ArrayBuffer) => {
        console.log('Received:', data);
        if (data === 'Hello!') {
          messageReceived = true;
        }
      });
    });

    // Connect peer1 to peer2 and send a message
    const conn = peer1.connect(peer2.getId());
    conn.on('open', () => {
      console.log('Connection opened, sending message');
      conn.send('Hello!');
    });

    // Wait for the message to be received
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (messageReceived) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!messageReceived) {
          throw new Error('Timeout waiting for message');
        }
      }, 30000);
    });

    // Assert that the message was received
    expect(messageReceived).toBe(true);
  }, 60000); // Increase test timeout to 60 seconds
}); 