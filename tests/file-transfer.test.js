const { describe, it, expect } = require('vitest');
const NodePeer = require('../src/node-peer');
const { Readable } = require('stream');

const TEST_TIMEOUT = 30000;
const CONNECT_TIMEOUT = 10000;

describe('Peer Connection', () => {
  it('should establish connection and exchange messages', async () => {
    const peer1 = new NodePeer({ debug: 0 });
    const peer2 = new NodePeer({ debug: 0 });

    let peer1Connected = false;
    let peer2Connected = false;
    let peer1ReceivedData = false;
    let peer2ReceivedData = false;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, TEST_TIMEOUT);

      peer1.on('open', async (id) => {
        peer2.on('open', async (peerId) => {
          const conn = peer1.connect(peerId);
          
          conn.on('open', () => {
            peer1Connected = true;
            conn.send('Hello from peer1!');
          });

          conn.on('data', (data) => {
            peer1ReceivedData = true;
            if (peer1Connected && peer2Connected && peer1ReceivedData && peer2ReceivedData) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      });

      peer2.on('connection', (conn) => {
        peer2Connected = true;
        
        conn.on('data', (data) => {
          peer2ReceivedData = true;
          conn.send('Hello from peer2!');
        });
      });
    });

    expect(peer1Connected).toBe(true);
    expect(peer2Connected).toBe(true);
    expect(peer1ReceivedData).toBe(true);
    expect(peer2ReceivedData).toBe(true);

    // Cleanup
    await Promise.all([
      new Promise(resolve => {
        peer1.destroy();
        resolve();
      }),
      new Promise(resolve => {
        peer2.destroy();
        resolve();
      })
    ]);
  }, TEST_TIMEOUT);

  it('should transfer data from stdin', async () => {
    const peer1 = new NodePeer({ debug: 0 });
    const peer2 = new NodePeer({ debug: 0 });

    const testData = 'Hello from stdin!';
    const stdinStream = new Readable({
      read() {
        this.push(testData);
        this.push(null);
      }
    });

    let receivedData = '';

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, TEST_TIMEOUT);

      peer1.on('open', async (id) => {
        peer2.on('open', async (peerId) => {
          const conn = peer1.connect(peerId);
          
          conn.on('open', () => {
            // Read from stdin stream and send data
            stdinStream.on('data', (chunk) => {
              conn.send({
                type: 'chunk',
                data: chunk.toString()
              });
            });

            stdinStream.on('end', () => {
              conn.send({ type: 'complete' });
            });
          });
        });
      });

      peer2.on('connection', (conn) => {
        conn.on('data', (data) => {
          if (data.type === 'chunk') {
            receivedData += data.data;
          } else if (data.type === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    });

    expect(receivedData).toBe(testData);

    // Cleanup
    await Promise.all([
      new Promise(resolve => {
        peer1.destroy();
        resolve();
      }),
      new Promise(resolve => {
        peer2.destroy();
        resolve();
      })
    ]);
  }, TEST_TIMEOUT);
});