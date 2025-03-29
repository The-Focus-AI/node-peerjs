# Lessons Learned

## Technical Insights

### WebRTC in Node.js
1. PeerJS requires browser environment mocking
   - Must mock window, navigator, and location objects
   - WebRTC globals need proper setup
   - adapter.js requires special handling

2. Connection Management
   - Connection establishment is asynchronous
   - Event handling is critical for state management
   - Cleanup requires careful handling

3. Testing Challenges
   - Segmentation faults during cleanup
   - Timing issues in connection tests
   - Need for increased timeouts

### Best Solutions

1. Browser Mocking
   ```typescript
   const globalProxy = new Proxy(global, {
     set(target: any, prop: string, value: any) {
       if (prop === 'navigator' || prop === 'window' || prop === 'location') {
         Object.defineProperty(target, prop, {
           value,
           writable: true,
           configurable: true
         });
         return true;
       }
       target[prop] = value;
       return true;
     }
   });
   ```

2. Connection Testing
   - Use polling instead of direct promises
   - Implement proper timeout handling
   - Skip cleanup in tests when possible

3. Error Handling
   - Catch and log all errors
   - Use try-catch in cleanup
   - Implement proper type checking

## Challenges and Solutions

### Challenge: Segmentation Faults
- **Problem**: node-webrtc crashes during cleanup
- **Solution**: Simplify cleanup process, avoid complex teardown
- **Learning**: Some native bindings have stability issues

### Challenge: Test Stability
- **Problem**: Flaky tests due to timing
- **Solution**: Implement polling and longer timeouts
- **Learning**: WebRTC connections need time to stabilize

### Challenge: Type Safety
- **Problem**: PeerJS types not fully compatible
- **Solution**: Use type assertions carefully
- **Learning**: Balance type safety with practicality

## Future Considerations

1. Cleanup Process
   - Consider alternative cleanup approaches
   - Investigate node-webrtc stability
   - Document known limitations

2. Testing Strategy
   - Implement more robust test patterns
   - Consider cleanup alternatives
   - Add stress testing

3. Error Handling
   - Implement retry logic
   - Add timeout handling
   - Improve error classification

## WebRTC Testing in Node.js (Sat Mar 29 05:48:25 EDT 2025)

### Testing Complex WebRTC Operations
1. Challenge: node-webrtc can be unstable in test environments
   - Solution: Skip complex operations in unit tests
   - Alternative: Plan for integration tests with real peers
   - Lesson: Some WebRTC operations are better tested in real-world scenarios

2. State Management
   - Always check signaling state before operations
   - Validate SDP existence before using it
   - Handle cleanup properly to avoid memory issues
   - Use proper type definitions for WebRTC interfaces

3. Error Handling Best Practices
   - Provide specific error messages for each failure case
   - Check state before operations
   - Validate all inputs thoroughly
   - Handle cleanup in error cases

4. Test Design
   - Start with simple, atomic tests
   - Gradually build up to complex operations
   - Have fallback test strategies for unstable features
   - Document known limitations and workarounds

### Implementation Insights
1. WebRTC Wrapper Design
   - Keep the API surface minimal and focused
   - Follow standard WebRTC patterns
   - Use TypeScript for better type safety
   - Implement proper event handling

2. State Management
   - Track connection state carefully
   - Handle all possible state transitions
   - Clean up resources properly
   - Use TypeScript types for better safety

3. Error Handling
   - Be specific about error conditions
   - Provide actionable error messages
   - Handle all edge cases
   - Clean up resources on errors

### Best Practices Identified
1. Testing
   - Unit test stable operations
   - Plan integration tests for complex features
   - Document test limitations
   - Provide alternative testing strategies

2. Implementation
   - Follow WebRTC standards
   - Use proper typing
   - Handle all states
   - Clean up resources

3. Documentation
   - Document known issues
   - Provide usage examples
   - Explain error cases
   - Include testing notes

## WebRTC Environment Setup

1. Browser environment mocking MUST be in the `NodePeer.ts` class file:
   - Required for the class to function
   - Ensures proper setup whenever the class is used
   - Prevents read-only property issues with proxy-based approach
   - Keeps all WebRTC dependencies in one place

2. Known Issues:
   - Segmentation fault during cleanup is a known issue with native WebRTC modules
   - Does not affect core functionality (connection and data transfer work)
   - Occurs after connections are properly closed
   - Related to the native module's memory management during process exit

3. Best Practices:
   - Keep browser mocking code in the main class file
   - Use proxy-based approach for global object modifications
   - Implement proper connection cleanup before destroying peers
   - Log all connection state changes for debugging
   - Add timeouts to prevent hanging operations 