# Architecture

## Tech Stack
- Node.js
- TypeScript
- PeerJS for WebRTC handling
- @roamhq/wrtc for Node.js WebRTC bindings
- Vitest for testing

## Directory Layout
```
.
├── src/
│   └── NodePeer.ts       # Main peer implementation
├── tests/
│   ├── NodePeer.test.ts  # Core functionality tests
│   ├── setup.test.ts     # Environment setup tests
│   └── peerjs/
│       └── peer.test.ts  # PeerJS integration tests
└── package.json
```

## Implementation Patterns

### Browser Environment Mocking
- Mock window, navigator, and location objects
- Set up WebRTC globals
- Configure adapter.js mocking

### Peer Management
- Single NodePeer class per connection
- Event-based communication
- Promise-based async operations

### Connection Handling
- DataConnection for peer communication
- Event listeners for connection lifecycle
- Error handling at connection level

### Testing Patterns
- Async test setup
- Connection verification
- Message exchange validation
- Timeout handling

### Error Handling
- Event emission for errors
- Promise rejection for async failures
- Console logging for debugging
- Try-catch blocks for cleanup

### Type Safety
- TypeScript for static typing
- Interface definitions for PeerJS types
- Event type definitions
- Connection type safety

## Best Practices
1. Always emit events for state changes
2. Use TypeScript for type safety
3. Handle cleanup gracefully
4. Log important operations
5. Implement proper error handling
6. Use promises for async operations
7. Follow event-driven architecture
8. Keep connection management simple

## Last Updated
Sat Mar 29 05:48:25 EDT 2025 

# Architecture Overview

## WebRTC Browser Environment Requirements

IMPORTANT: The browser environment mocking code MUST be kept in the `NodePeer.ts` class file, NOT in test files. This is critical because:
1. The mocking is required for the class to function, not just for testing
2. It ensures the browser environment is properly set up whenever the class is used
3. It prevents issues with read-only properties by using a proxy-based approach
4. It maintains all WebRTC dependencies and mocks in a single, predictable location

The mocking includes:
- Browser environment (window, navigator, location)
- WebRTC objects (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate)
- webrtc-adapter mocking
- PeerJS utility support detection

## Directory Layout

- `src/` - Source code
  - `NodePeer.ts` - Main peer-to-peer implementation with required browser mocking
- `tests/` - Test files
  - `setup.ts` - Empty by design (browser mocking handled in NodePeer.ts)
  - `NodePeer.test.ts` - Tests for peer functionality

## Implementation Patterns

1. Browser Environment Mocking:
   - Always use the proxy-based approach for setting global objects
   - Keep all mocking code in the main class file
   - Use type assertions (as any) to handle read-only properties

2. Error Handling:
   - Log all errors with descriptive messages
   - Implement proper cleanup in error cases
   - Use async/await with try/catch blocks

3. Connection Management:
   - Clean up connections before destroying peers
   - Add timeouts for operations that could hang
   - Log connection state changes for debugging 