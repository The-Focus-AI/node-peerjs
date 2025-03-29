import { NodePeer } from '../../src-js/NodePeer.js';
import readline from 'readline';

/**
 * @typedef {Object} ChatMessage
 * @property {'message'} type
 * @property {string} sender
 * @property {string} content
 * @property {string} timestamp
 */

class ChatApp {
  /** @type {NodePeer} */
  peer;
  /** @type {Map<string, import('peerjs').DataConnection>} */
  connections = new Map();
  /** @type {readline.Interface} */
  rl;
  /** @type {string} */
  username;

  /**
   * Create a new chat application
   * @param {string} [peerId] - Optional peer ID to connect to
   */
  constructor(peerId = null) {
    this.peer = new NodePeer();
    this.setupPeer();
    this.targetPeerId = peerId;
  }

  /**
   * Set up the peer event handlers
   */
  setupPeer() {
    this.peer.on('open', (id) => {
      console.log('\nYour peer ID:', id);
      this.promptUsername();
    });

    this.peer.on('connection', (conn) => {
      this.handleNewConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('\nPeer error:', err);
    });
  }

  /**
   * Handle a new peer connection
   * @param {import('peerjs').DataConnection} conn
   */
  handleNewConnection(conn) {
    console.log(`\nNew peer connected: ${conn.peer}`);
    
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.broadcastMessage('system', `${conn.peer} joined the chat`);
    });

    conn.on('data', (data) => {
      /** @type {ChatMessage} */
      const message = data;
      if (message.type === 'message') {
        this.printMessage(message);
      }
    });

    conn.on('close', () => {
      console.log(`\nPeer disconnected: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.broadcastMessage('system', `${conn.peer} left the chat`);
    });

    conn.on('error', (err) => {
      console.error(`\nConnection error with ${conn.peer}:`, err);
    });
  }

  /**
   * Prompt for username and start the chat
   */
  promptUsername() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.rl.question('Enter your username: ', (username) => {
      this.username = username;
      console.log(`\nWelcome ${username}! Type your messages and press Enter to send.`);
      console.log('Type /quit to exit the chat.\n');

      // If we have a target peer, connect to it
      if (this.targetPeerId) {
        const conn = this.peer.connect(this.targetPeerId);
        this.handleNewConnection(conn);
      }

      // Start reading messages
      this.readMessages();
    });
  }

  /**
   * Read messages from stdin
   */
  readMessages() {
    this.rl.on('line', (line) => {
      if (line.trim() === '/quit') {
        this.cleanup();
        return;
      }

      if (line.trim()) {
        this.broadcastMessage('user', line.trim());
      }
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      this.cleanup();
    });
  }

  /**
   * Print a chat message
   * @param {ChatMessage} message
   */
  printMessage(message) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    if (message.sender === 'system') {
      console.log(`\n[${timestamp}] *** ${message.content} ***`);
    } else {
      console.log(`\n[${timestamp}] ${message.sender}: ${message.content}`);
    }
  }

  /**
   * Broadcast a message to all connected peers
   * @param {'user' | 'system'} messageType
   * @param {string} content
   */
  broadcastMessage(messageType, content) {
    /** @type {ChatMessage} */
    const message = {
      type: 'message',
      sender: messageType === 'system' ? 'system' : this.username,
      content,
      timestamp: new Date().toISOString()
    };

    // Print our own message
    this.printMessage(message);

    // Send to all peers
    for (const conn of this.connections.values()) {
      conn.send(message);
    }
  }

  /**
   * Clean up resources and exit
   */
  cleanup() {
    console.log('\nLeaving chat...');
    this.broadcastMessage('system', `${this.username} left the chat`);
    
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    // Close the readline interface
    this.rl.close();

    // Clean up the peer
    this.peer.cleanup().then(() => {
      console.log('Goodbye!');
      process.exit(0);
    });
  }
}

// Parse command line arguments
const peerId = process.argv[2];
new ChatApp(peerId); 