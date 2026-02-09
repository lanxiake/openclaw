/**
 * WebSocket Connection Test
 * Tests WebSocket connection to the gateway
 */

const WebSocket = require('ws');

const GATEWAY_URL = process.argv[2] || 'ws://127.0.0.1:18789';
const TIMEOUT_MS = 5000;

console.log('=== WebSocket Connection Test ===');
console.log(`Gateway URL: ${GATEWAY_URL}`);
console.log(`Timeout: ${TIMEOUT_MS}ms\n`);

let connected = false;
let handshakeComplete = false;
const startTime = Date.now();

const ws = new WebSocket(GATEWAY_URL);

// Connection opened
ws.on('open', () => {
  const connectTime = Date.now() - startTime;
  connected = true;
  console.log(`✓ [PASS] WebSocket connection established (${connectTime}ms)`);
  console.log('  Waiting for connect.challenge event...');
});

// Message received
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`  Received message: type=${message.type}, event=${message.event || 'N/A'}`);

    // Check for connect.challenge event
    if (message.type === 'event' && message.event === 'connect.challenge') {
      console.log(`✓ [PASS] Received connect.challenge event`);
      console.log(`  Nonce: ${message.payload?.nonce}`);
      handshakeComplete = true;

      // Send connect request
      const connectRequest = {
        type: 'req',
        id: `test-${Date.now()}`,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'test-client',
            displayName: 'Test Client',
            version: '0.1.0',
            platform: 'win32',
            mode: 'ui'
          },
          caps: ['skill.local', 'file.ops', 'system.cmd'],
          role: 'operator',
          scopes: ['operator.admin']
        }
      };

      console.log('  Sending connect request...');
      ws.send(JSON.stringify(connectRequest));
    }

    // Check for connect response
    if (message.type === 'res' && message.ok) {
      console.log(`✓ [PASS] Handshake completed successfully`);
      console.log(`  Protocol version: ${message.payload?.protocol || 'N/A'}`);

      // Test complete, close connection
      setTimeout(() => {
        ws.close();
      }, 500);
    }
  } catch (error) {
    console.log(`  Error parsing message: ${error.message}`);
  }
});

// Connection closed
ws.on('close', (code, reason) => {
  const totalTime = Date.now() - startTime;
  console.log(`\n✓ [INFO] Connection closed (${totalTime}ms)`);
  console.log(`  Code: ${code}`);
  console.log(`  Reason: ${reason || 'N/A'}`);

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Connection: ${connected ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Handshake: ${handshakeComplete ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Total Time: ${totalTime}ms`);

  if (connected && handshakeComplete) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
});

// Connection error
ws.on('error', (error) => {
  console.log(`✗ [FAIL] WebSocket error: ${error.message}`);
  console.log(`  Code: ${error.code || 'N/A'}`);

  console.log('\n=== Test Summary ===');
  console.log('Connection: FAILED');
  console.log(`Error: ${error.message}`);

  process.exit(1);
});

// Timeout handler
setTimeout(() => {
  if (!connected) {
    console.log(`✗ [FAIL] Connection timeout (${TIMEOUT_MS}ms)`);
    ws.close();
    process.exit(1);
  } else if (!handshakeComplete) {
    console.log(`✗ [FAIL] Handshake timeout (${TIMEOUT_MS}ms)`);
    ws.close();
    process.exit(1);
  }
}, TIMEOUT_MS);
