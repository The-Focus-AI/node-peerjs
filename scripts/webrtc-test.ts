import wrtc from '@roamhq/wrtc';
const { RTCPeerConnection } = wrtc;

// Create two peers
const peer1 = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

const peer2 = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Setup data channel
const channel1 = peer1.createDataChannel('test-channel');

channel1.onopen = () => {
  console.log('Data channel is open');
  channel1.send('Hello from peer1!');
};

channel1.onmessage = (event: MessageEvent) => {
  console.log('Peer1 received:', event.data);
};

// Handle ICE candidates
peer1.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
  if (event.candidate) {
    console.log('Peer1 ICE candidate:', event.candidate.candidate);
    peer2.addIceCandidate(event.candidate).catch(console.error);
  }
};

peer2.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
  if (event.candidate) {
    console.log('Peer2 ICE candidate:', event.candidate.candidate);
    peer1.addIceCandidate(event.candidate).catch(console.error);
  }
};

// Handle data channel on peer2
peer2.ondatachannel = (event: RTCDataChannelEvent) => {
  const channel2 = event.channel;
  
  channel2.onopen = () => {
    console.log('Peer2 data channel is open');
  };
  
  channel2.onmessage = (event: MessageEvent) => {
    console.log('Peer2 received:', event.data);
    channel2.send('Hello back from peer2!');
  };
};

// Connection state changes
peer1.onconnectionstatechange = () => {
  console.log('Peer1 connection state:', peer1.connectionState);
};

peer2.onconnectionstatechange = () => {
  console.log('Peer2 connection state:', peer2.connectionState);
};

// Signaling state changes
peer1.onsignalingstatechange = () => {
  console.log('Peer1 signaling state:', peer1.signalingState);
};

peer2.onsignalingstatechange = () => {
  console.log('Peer2 signaling state:', peer2.signalingState);
};

// Start the connection process
async function connect() {
  try {
    // Create offer
    const offer = await peer1.createOffer();
    console.log('Created offer');
    
    // Set local description on peer1
    await peer1.setLocalDescription(offer);
    console.log('Peer1 set local description');
    
    // Set remote description on peer2
    await peer2.setRemoteDescription(offer);
    console.log('Peer2 set remote description');
    
    // Create answer
    const answer = await peer2.createAnswer();
    console.log('Created answer');
    
    // Set local description on peer2
    await peer2.setLocalDescription(answer);
    console.log('Peer2 set local description');
    
    // Set remote description on peer1
    await peer1.setRemoteDescription(answer);
    console.log('Peer1 set remote description');
    
    console.log('Connection setup completed');
  } catch (error) {
    console.error('Error during connection setup:', error);
  }
}

// Run the connection
connect().catch(console.error);

// Keep the process running
process.stdin.resume();

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Cleaning up...');
  peer1.close();
  peer2.close();
  process.exit();
}); 