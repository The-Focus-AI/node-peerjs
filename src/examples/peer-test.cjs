const wrtc = require('@roamhq/wrtc');
const { Peer } = require('peerjs');

// Mock webrtc-adapter
const webrtcAdapter = {
  browserDetails: {
    browser: 'chrome',
    version: 122
  }
};

// Mock browser environment
global.window = {
  RTCPeerConnection: wrtc.RTCPeerConnection,
  RTCSessionDescription: wrtc.RTCSessionDescription,
  RTCIceCandidate: wrtc.RTCIceCandidate,
  isSecureContext: true,
  RTCRtpTransceiver: {
    prototype: {
      currentDirection: null
    }
  }
};

global.navigator = {
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

global.location = {
  protocol: 'https:'
};

// Also set global WebRTC objects
global.RTCPeerConnection = wrtc.RTCPeerConnection;
global.RTCSessionDescription = wrtc.RTCSessionDescription;
global.RTCIceCandidate = wrtc.RTCIceCandidate;

// Mock require('webrtc-adapter')
require.cache[require.resolve('webrtc-adapter')] = {
  exports: webrtcAdapter
};

// Mock WebRTC support detection
const util = require('peerjs').util;
util.supports.data = true;
util.supports.audioVideo = true;
util.supports.reliable = true;
util.supports.binaryBlob = true;
util.supports.browser = true;
util.supports.webRTC = true;

// Store peers globally for cleanup
let peer1 = null;
let peer2 = null;

// Handle cleanup before process exit
process.on('beforeExit', async () => {
  console.log('Process exiting, cleaning up...');
  
  // Close peer1
  if (peer1) {
    try {
      peer1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      peer1.destroy();
      peer1 = null;
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  // Close peer2
  if (peer2) {
    try {
      peer2.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      peer2.destroy();
      peer2 = null;
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  // Final delay to allow cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Handle SIGINT
process.on('SIGINT', () => {
  console.log('Received SIGINT, cleaning up...');
  process.exit(0);
});

async function cleanup(peer, label = '') {
  if (!peer) return;
  
  try {
    console.log(`Starting cleanup for ${label}...`);
    
    // Get all connections
    const connections = peer.connections || {};
    
    // Close all data connections first
    for (const [peerId, conns] of Object.entries(connections)) {
      for (const conn of conns) {
        try {
          if (conn.dataChannel) {
            console.log(`Closing data channel for ${label} -> ${peerId}...`);
            conn.dataChannel.close();
          }
          if (conn.close) {
            console.log(`Closing connection for ${label} -> ${peerId}...`);
            conn.close();
          }
        } catch (err) {
          console.error(`Error closing connection ${label} -> ${peerId}:`, err);
        }
      }
    }
    
    // Wait a bit for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Disconnect from server
    try {
      console.log(`Disconnecting ${label} from server...`);
      peer.disconnect();
    } catch (err) {
      console.error(`Error disconnecting ${label}:`, err);
    }
    
    // Wait a bit for disconnect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Destroy the peer
    try {
      console.log(`Destroying ${label}...`);
      peer.destroy();
    } catch (err) {
      console.error(`Error destroying ${label}:`, err);
    }
    
    console.log(`Cleanup complete for ${label}`);
  } catch (err) {
    console.error(`Error during cleanup for ${label}:`, err);
  }
}

async function testPeerJS() {
  let peer1 = null;
  let peer2 = null;
  let connectionTimeout = null;
  
  try {
    // Create peers with explicit server configuration
    const peerConfig = {
      host: '0.peerjs.com',
      secure: true,
      port: 443,
      debug: 3, // Enable all debug logs
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };
    
    peer1 = new Peer(peerConfig);
    peer2 = new Peer(peerConfig);
    
    // Set up connection timeout (30 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      connectionTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);
    });
    
    // Set up connection promise
    const connectionPromise = new Promise((resolve, reject) => {
      let peer1Ready = false;
      let peer2Ready = false;
      let peer1Id = null;
      let peer2Id = null;
      
      // Helper to check if both peers are ready
      const tryConnect = () => {
        if (peer1Ready && peer2Ready) {
          console.log(`Attempting connection from ${peer1Id} to ${peer2Id}`);
          const conn = peer1.connect(peer2Id, {
            reliable: true,
            serialization: 'json'
          });
          
          conn.on('open', () => {
            console.log('Connection established');
            conn.send('Hello from Node.js!');
          });
          
          conn.on('error', err => {
            console.error('Connection error:', err);
            reject(err);
          });
        }
      };
      
      // Set up peer1
      peer1.on('open', id => {
        console.log('Peer1 ready with ID:', id);
        peer1Ready = true;
        peer1Id = id;
        tryConnect();
      });
      
      peer1.on('error', err => {
        console.error('Peer1 error:', err);
        reject(err);
      });
      
      // Set up peer2
      peer2.on('open', id => {
        console.log('Peer2 ready with ID:', id);
        peer2Ready = true;
        peer2Id = id;
        tryConnect();
        
        peer2.on('connection', conn => {
          console.log('Peer2 received connection');
          
          conn.on('data', data => {
            console.log('Received:', data);
            resolve();
          });
          
          conn.on('error', err => {
            console.error('Peer2 connection error:', err);
            reject(err);
          });
        });
      });
      
      peer2.on('error', err => {
        console.error('Peer2 error:', err);
        reject(err);
      });
    });
    
    // Wait for either connection or timeout
    await Promise.race([connectionPromise, timeoutPromise]);
    
    // Clear timeout if connection succeeded
    clearTimeout(connectionTimeout);
    
    // Wait a bit to ensure message is processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Test completed successfully');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    // Clean up peers
    console.log('Starting cleanup...');
    await cleanup(peer1, 'peer1');
    await cleanup(peer2, 'peer2');
    console.log('Cleanup finished');
    
    // Force exit after cleanup
    process.exit(process.exitCode || 0);
  }
}

// Run the test
testPeerJS().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 