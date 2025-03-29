import { NodePeer } from '../../src-js/NodePeer.js';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';

// Size of each chunk in bytes (1MB)
const CHUNK_SIZE = 1024 * 1024;

/**
 * @typedef {Object} FileMetadata
 * @property {'metadata'} type
 * @property {string} fileName
 * @property {number} size
 * @property {number} totalChunks
 */

/**
 * @typedef {Object} FileChunk
 * @property {'chunk'} type
 * @property {number} chunkIndex
 * @property {ArrayBuffer} data
 */

/**
 * @typedef {Object} TransferComplete
 * @property {'complete'} type
 */

/**
 * @typedef {FileMetadata | FileChunk | TransferComplete} TransferMessage
 */

/**
 * Send data from a stream to a peer
 * @param {Readable} stream - The stream to read from
 * @param {string} [fileName='stdin'] - Name to use for the transferred data
 * @returns {Promise<void>}
 */
async function sendStream(stream, fileName = 'stdin') {
  const peer = new NodePeer();
  const chunks = [];
  let conn = null;
  let cleanupStarted = false;
  
  try {
    // Collect all chunks from the stream
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Calculate total size and chunks
    const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    console.log('Waiting for peer to be ready...');
    // Wait for peer to be ready
    const peerId = await new Promise((resolve) => {
      peer.once('open', (id) => {
        console.log('Peer ready with ID:', id);
        console.log('Your peer ID:', id);
        console.log('Waiting for receiver to connect...');
        resolve(id);
      });
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!cleanupStarted) {
          reject(new Error('Timeout waiting for receiver to connect'));
        }
      }, 30000);

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        clearTimeout(timeout);
        if (!cleanupStarted) {
          reject(err);
        }
      });

      peer.on('connection', async (newConn) => {
        clearTimeout(timeout);
        conn = newConn;
        console.log('Receiver connected!');
        
        conn.on('error', (err) => {
          console.error('Connection error:', err);
          if (!cleanupStarted) {
            reject(err);
          }
        });

        conn.on('close', () => {
          console.log('Connection closed by receiver');
          if (!cleanupStarted) {
            reject(new Error('Connection closed unexpectedly'));
          }
        });

        conn.on('open', async () => {
          console.log('Connection opened, starting data transfer...');
          try {
            // Send metadata
            console.log('Sending metadata...');
            conn.send({
              type: 'metadata',
              fileName,
              size: totalSize,
              totalChunks
            });

            // Send data in chunks
            let offset = 0;
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              conn.send({
                type: 'chunk',
                chunkIndex: i,
                data: chunk
              });

              offset += chunk.length;
              // Report progress
              const progress = Math.round(offset / totalSize * 100);
              console.log(`Sending progress: ${progress}%`);
            }

            // Send completion message
            conn.send({ type: 'complete' });
            console.log('Data sent successfully');
            resolve();
          } catch (err) {
            console.error('Error during data transfer:', err);
            if (!cleanupStarted) {
              reject(err);
            }
          }
        });
      });
    });
  } catch (err) {
    console.error('Error sending data:', err);
    throw err;
  } finally {
    cleanupStarted = true;
    console.log('Starting cleanup...');
    try {
      if (conn) {
        conn.close();
      }
      await peer.cleanup();
      console.log('Cleanup complete');
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
    process.exit(0); // Ensure clean exit
  }
}

/**
 * Send a file to a peer
 * @param {string} filePath - Path to the file to send
 * @returns {Promise<void>}
 */
async function sendFile(filePath) {
  const peer = new NodePeer();
  
  try {
    // Wait for peer to be ready
    const peerId = await new Promise((resolve) => {
      peer.once('open', (id) => {
        console.log('Your peer ID:', id);
        resolve(id);
      });
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for receiver to connect'));
      }, 30000);

      peer.once('connection', async (conn) => {
        clearTimeout(timeout);
        console.log('Receiver connected');
        
        try {
          // Get file stats
          const stats = await stat(filePath);
          const fileName = filePath.split('/').pop() || 'unknown';
          const totalChunks = Math.ceil(stats.size / CHUNK_SIZE);
          
          // Send metadata
          conn.send({
            type: 'metadata',
            fileName,
            size: stats.size,
            totalChunks
          });

          // Read and send file in chunks
          const fileHandle = await readFile(filePath);
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, stats.size);
            const chunk = fileHandle.slice(start, end);
            
            conn.send({
              type: 'chunk',
              chunkIndex: i,
              data: chunk
            });

            // Report progress
            const progress = Math.round((i + 1) / totalChunks * 100);
            console.log(`Sending progress: ${progress}%`);
          }

          // Send completion message
          conn.send({ type: 'complete' });
          console.log('File sent successfully');
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      peer.on('error', reject);
    });
  } catch (err) {
    console.error('Error sending file:', err);
    throw err;
  } finally {
    await peer.cleanup();
  }
}

/**
 * Receive a file from a peer
 * @param {string} peerId - ID of the peer to receive from
 * @param {string} [outputDir='.'] - Directory to save the file in
 * @returns {Promise<void>}
 */
async function receiveFile(peerId, outputDir = '.') {
  const peer = new NodePeer({ debug: false }); // Disable PeerJS debug logs
  let conn = null;
  let cleanupStarted = false;
  
  try {
    console.log('Waiting for peer to be ready...');
    await new Promise((resolve) => {
      peer.once('open', (id) => {
        console.log('Peer ready with ID:', id);
        resolve();
      });
    });

    console.log('Connecting to sender:', peerId);
    conn = peer.connect(peerId);
    
    await new Promise((resolve, reject) => {
      let fileName;
      let fileSize;
      let totalChunks;
      let receivedChunks = [];
      let metadata = null;
      let lastProgressUpdate = 0;
      let transferComplete = false;

      const timeout = setTimeout(() => {
        if (!cleanupStarted) {
          reject(new Error('Timeout waiting for connection'));
        }
      }, 30000);

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        clearTimeout(timeout);
        if (!cleanupStarted && !transferComplete) {
          reject(err);
        }
      });

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to sender successfully');
      });

      conn.on('close', () => {
        console.log('Connection closed by sender');
        if (!cleanupStarted && !transferComplete) {
          reject(new Error('Connection closed unexpectedly'));
        }
      });

      /**
       * @param {TransferMessage} data
       */
      conn.on('data', async (data) => {
        try {
          switch (data.type) {
            case 'metadata':
              metadata = data;
              fileName = data.fileName;
              fileSize = data.size;
              totalChunks = data.totalChunks;
              receivedChunks = new Array(totalChunks);
              console.log(`\nReceiving: ${fileName}`);
              console.log(`Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
              console.log('\nProgress: 0%');
              break;

            case 'chunk':
              if (!metadata) {
                throw new Error('Received chunk before metadata');
              }
              receivedChunks[data.chunkIndex] = data.data;
              
              // Only update progress every 5%
              const currentProgress = Math.round((receivedChunks.filter(Boolean).length / totalChunks) * 100);
              if (currentProgress >= lastProgressUpdate + 5) {
                process.stdout.write(`\rProgress: ${currentProgress}%`);
                lastProgressUpdate = currentProgress;
              }
              break;

            case 'complete':
              if (!metadata || !fileName) {
                throw new Error('Received complete before metadata');
              }
              process.stdout.write('\rProgress: 100%\n');
              
              console.log('\nSaving file...');
              const completeFile = new Uint8Array(fileSize);
              let offset = 0;
              for (const chunk of receivedChunks) {
                const chunkArray = new Uint8Array(chunk);
                completeFile.set(chunkArray, offset);
                offset += chunkArray.length;
              }
              
              const outputPath = join(outputDir, fileName);
              await writeFile(outputPath, completeFile);
              console.log(`\n✓ File saved successfully to: ${outputPath}\n`);
              transferComplete = true;
              resolve();
              break;
          }
        } catch (err) {
          console.error('Error processing data:', err);
          if (!cleanupStarted) {
            reject(err);
          }
        }
      });
    });
  } catch (err) {
    console.error('\nError:', err.message);
    throw err;
  } finally {
    cleanupStarted = true;
    console.log('Starting cleanup...');
    try {
      if (conn) {
        conn.close();
      }
      await peer.cleanup();
      console.log('Cleanup complete');
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
    process.exit(0); // Ensure clean exit
  }
}

/**
 * Parse and validate command line arguments
 * @returns {{ mode: 'send' | 'receive', filePath?: string, peerId?: string, outputDir?: string }}
 */
function parseArgs() {
  const [mode, ...args] = process.argv.slice(2);

  if (!mode) {
    throw new Error('Mode is required (send or receive)');
  }

  if (mode !== 'send' && mode !== 'receive') {
    throw new Error('Mode must be either "send" or "receive"');
  }

  if (mode === 'send') {
    const [filePath] = args;
    // If no file path is provided, we'll read from stdin
    return { mode, filePath };
  }

  if (mode === 'receive') {
    const [peerId, outputDir] = args;
    if (!peerId) {
      throw new Error('Peer ID is required for receive mode');
    }
    return { mode, peerId, outputDir };
  }

  throw new Error('Invalid arguments');
}

/**
 * Main function to handle the file transfer
 */
async function main() {
  try {
    const args = parseArgs();

    if (args.mode === 'send') {
      if (args.filePath) {
        await sendFile(args.filePath);
      } else {
        // Read from stdin
        await sendStream(process.stdin);
      }
    } else {
      await receiveFile(args.peerId, args.outputDir);
    }
  } catch (err) {
    console.error('\nError:', err.message);
    console.error('\nUsage:');
    console.error('  Send file:    node file-transfer.js send <file-path>');
    console.error('  Send stdin:   node file-transfer.js send');
    console.error('  Receive:      node file-transfer.js receive <peer-id> [output-dir]');
    console.error('\nExamples:');
    console.error('  node file-transfer.js send ./myfile.txt');
    console.error('  echo "Hello" | node file-transfer.js send');
    console.error('  node file-transfer.js receive abc123-xyz789');
    console.error('  node file-transfer.js receive abc123-xyz789 ./downloads\n');
    process.exit(1);
  }
}

// Run the program
main(); 