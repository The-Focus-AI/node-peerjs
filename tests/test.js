import { NodePeer } from '../src-js/NodePeer.js';

// Simple test runner
async function runTest(name, testFn) {
  try {
    console.log(`\nRunning test: ${name}`);
    await testFn();
    console.log(`✓ ${name} passed\n`);
    return true;
  } catch (err) {
    console.error(`✗ ${name} failed:`, err);
    return false;
  }
}

// Test peer connection and message exchange
async function testPeerConnection() {
  const peer1 = new NodePeer();
  const peer2 = new NodePeer();
  
  try {
    // Wait for both peers to be ready
    const [id1, id2] = await Promise.all([
      new Promise(resolve => peer1.once('open', id => resolve(id))),
      new Promise(resolve => peer2.once('open', id => resolve(id)))
    ]);
    
    console.log('Peer1 ID:', id1);
    console.log('Peer2 ID:', id2);
    
    // Test bidirectional message exchange
    await new Promise((resolve, reject) => {
      const message1 = 'Hello from peer1!';
      const message2 = 'Hello from peer2!';
      let peer1MessageReceived = false;
      let peer2MessageReceived = false;
      
      // Set up peer2 receiver
      peer2.on('connection', conn => {
        console.log('Peer2 received connection');
        conn.on('data', data => {
          console.log('Peer2 received:', data);
          if (data === message1) {
            peer2MessageReceived = true;
            // Send response back
            conn.send(message2);
          }
          checkComplete();
        });
      });
      
      // Connect peer1 to peer2
      const conn = peer1.connect(id2);
      conn.on('open', () => {
        console.log('Peer1 connection opened, sending message');
        conn.on('data', data => {
          console.log('Peer1 received:', data);
          if (data === message2) {
            peer1MessageReceived = true;
            checkComplete();
          }
        });
        conn.send(message1);
      });
      
      function checkComplete() {
        if (peer1MessageReceived && peer2MessageReceived) {
          resolve();
        }
      }
      
      // Set timeout
      setTimeout(() => {
        const errors = [];
        if (!peer1MessageReceived) errors.push('Peer1 never received message');
        if (!peer2MessageReceived) errors.push('Peer2 never received message');
        reject(new Error('Timeout: ' + errors.join(', ')));
      }, 30000);
    });
    
  } finally {
    // Clean up
    console.log('Starting cleanup...');
    await peer1.cleanup();
    await peer2.cleanup();
    console.log('Cleanup complete');
  }
}

// Run all tests
async function runTests() {
  const tests = [
    ['Peer Connection', testPeerConnection]
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, testFn] of tests) {
    if (await runTest(name, testFn)) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\nTest Results:');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
}); 