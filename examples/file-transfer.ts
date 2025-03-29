import { NodePeer } from '../src/NodePeer.js';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';

// Size of each chunk in bytes (1MB)
const CHUNK_SIZE = 1024 * 1024;

interface FileMetadata {
  type: 'metadata';
  fileName: string;
  size: number;
  totalChunks: number;
}

interface FileChunk {
  type: 'chunk';
  chunkIndex: number;
  data: ArrayBuffer;
}

interface TransferComplete {
  type: 'complete';
}

type TransferMessage = FileMetadata | FileChunk | TransferComplete;

async function sendFile(filePath: string): Promise<void> {
  const peer = new NodePeer();
  
  try {
    // Wait for peer to be ready
    const peerId = await new Promise<string>((resolve) => {
      peer.once('open', (id) => {
        console.log('Your peer ID:', id);
        resolve(id);
      });
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
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
          } as FileMetadata);

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
            } as FileChunk);

            // Report progress
            const progress = Math.round((i + 1) / totalChunks * 100);
            console.log(`Sending progress: ${progress}%`);
          }

          // Send completion message
          conn.send({ type: 'complete' } as TransferComplete);
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

async function receiveFile(peerId: string, outputDir: string = '.'): Promise<void> {
  const peer = new NodePeer();
  
  try {
    console.log('Connecting to peer:', peerId);
    const conn = peer.connect(peerId);
    
    await new Promise<void>((resolve, reject) => {
      let fileName: string;
      let fileSize: number;
      let totalChunks: number;
      let receivedChunks: ArrayBuffer[] = [];
      let metadata: FileMetadata | null = null;

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for connection'));
      }, 30000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to sender');
      });

      conn.on('data', async (data: TransferMessage) => {
        try {
          switch (data.type) {
            case 'metadata':
              metadata = data;
              fileName = data.fileName;
              fileSize = data.size;
              totalChunks = data.totalChunks;
              receivedChunks = new Array(totalChunks);
              console.log(`Receiving file: ${fileName} (${fileSize} bytes)`);
              break;

            case 'chunk':
              if (!metadata) {
                throw new Error('Received chunk before metadata');
              }
              receivedChunks[data.chunkIndex] = data.data;
              const progress = Math.round((receivedChunks.filter(Boolean).length / totalChunks) * 100);
              console.log(`Receiving progress: ${progress}%`);
              break;

            case 'complete':
              if (!metadata || !fileName) {
                throw new Error('Received complete before metadata');
              }
              // Combine chunks and save file
              const completeFile = new Uint8Array(fileSize);
              let offset = 0;
              for (const chunk of receivedChunks) {
                const chunkArray = new Uint8Array(chunk);
                completeFile.set(chunkArray, offset);
                offset += chunkArray.length;
              }
              
              const outputPath = join(outputDir, fileName);
              await writeFile(outputPath, completeFile);
              console.log(`File saved to: ${outputPath}`);
              resolve();
              break;
          }
        } catch (err) {
          reject(err);
        }
      });
      
      conn.on('error', reject);
    });
  } catch (err) {
    console.error('Error receiving file:', err);
    throw err;
  } finally {
    await peer.cleanup();
  }
}

// Parse and validate command line arguments
function parseArgs(): { mode: 'send' | 'receive'; filePath?: string; peerId?: string; outputDir?: string } {
  const [mode, ...args] = process.argv.slice(2);

  if (!mode) {
    throw new Error('Mode is required (send or receive)');
  }

  if (mode !== 'send' && mode !== 'receive') {
    throw new Error('Mode must be either "send" or "receive"');
  }

  if (mode === 'send') {
    const [filePath] = args;
    if (!filePath) {
      throw new Error('File path is required for send mode');
    }
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

// Main function to handle the file transfer
async function main() {
  try {
    const args = parseArgs();

    if (args.mode === 'send') {
      await sendFile(args.filePath!);
    } else {
      await receiveFile(args.peerId!, args.outputDir);
    }
  } catch (err) {
    console.error('\nError:', (err as Error).message);
    console.error('\nUsage:');
    console.error('  Send:    node file-transfer.js send <file-path>');
    console.error('  Receive: node file-transfer.js receive <peer-id> [output-dir]');
    console.error('\nExamples:');
    console.error('  node file-transfer.js send ./myfile.txt');
    console.error('  node file-transfer.js receive abc123-xyz789');
    console.error('  node file-transfer.js receive abc123-xyz789 ./downloads\n');
    process.exit(1);
  }
}

// Run the program
main(); 