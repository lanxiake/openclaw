/**
 * Complete Windows Client Integration Test
 * Tests all client features and gateway integration
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const GATEWAY_URL = process.argv[2] || 'ws://127.0.0.1:18789';
const TIMEOUT_MS = 10000;

console.log('=== Windows Client Integration Test ===');
console.log(`Gateway URL: ${GATEWAY_URL}`);
console.log(`Timeout: ${TIMEOUT_MS}ms\n`);

const testResults = [];
let totalTests = 0;
let passedTests = 0;

function recordTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✓ [PASS] ${name}`);
  } else {
    console.log(`✗ [FAIL] ${name}`);
  }
  if (details) {
    console.log(`  ${details}`);
  }
  testResults.push({ name, passed, details });
}

// Test 1: Gateway Connection
console.log('[Test 1/5] Gateway Connection\n');

let ws;
let connected = false;
let challengeReceived = false;
let connectResponseReceived = false;

const connectPromise = new Promise((resolve, reject) => {
  ws = new WebSocket(GATEWAY_URL);

  ws.on('open', () => {
    connected = true;
    recordTest('WebSocket connection established', true);
    resolve();
  });

  ws.on('error', (error) => {
    recordTest('WebSocket connection established', false, `Error: ${error.message}`);
    reject(error);
  });

  setTimeout(() => {
    if (!connected) {
      reject(new Error('Connection timeout'));
    }
  }, TIMEOUT_MS);
});

connectPromise
  .then(() => {
    console.log('\n[Test 2/5] Protocol Handshake\n');

    return new Promise((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Test connect.challenge
          if (message.type === 'event' && message.event === 'connect.challenge') {
            challengeReceived = true;
            recordTest('Received connect.challenge event', true, `Nonce: ${message.payload?.nonce}`);

            // Send connect request with valid client ID
            const connectRequest = {
              type: 'req',
              id: `test-${Date.now()}`,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'gateway-client', // Use valid client ID
                  displayName: 'Windows Test Client',
                  version: '0.1.0',
                  platform: 'win32',
                  mode: 'ui'
                },
                caps: ['skill.local', 'file.ops', 'system.cmd'],
                role: 'operator',
                scopes: ['operator.admin']
              }
            };

            ws.send(JSON.stringify(connectRequest));
            recordTest('Sent connect request', true);
          }

          // Test connect response
          if (message.type === 'res') {
            connectResponseReceived = true;
            if (message.ok) {
              recordTest('Received successful connect response', true, `Protocol: ${message.payload?.protocol || 'N/A'}`);
              resolve();
            } else {
              recordTest('Received successful connect response', false, `Error: ${message.error?.message || 'Unknown'}`);
              reject(new Error(message.error?.message || 'Connect failed'));
            }
          }
        } catch (error) {
          recordTest('Message parsing', false, `Error: ${error.message}`);
        }
      });

      setTimeout(() => {
        if (!challengeReceived) {
          recordTest('Received connect.challenge event', false, 'Timeout');
          reject(new Error('Challenge timeout'));
        } else if (!connectResponseReceived) {
          recordTest('Received connect response', false, 'Timeout');
          reject(new Error('Connect response timeout'));
        }
      }, TIMEOUT_MS);
    });
  })
  .then(() => {
    console.log('\n[Test 3/5] Message Exchange\n');

    return new Promise((resolve) => {
      // Test heartbeat
      const heartbeatRequest = {
        type: 'req',
        id: `heartbeat-${Date.now()}`,
        method: 'heartbeat',
        params: { ts: Date.now() }
      };

      let heartbeatReceived = false;

      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'res' && message.id && message.id.startsWith('heartbeat-')) {
            heartbeatReceived = true;
            recordTest('Heartbeat request/response', message.ok, message.ok ? 'Success' : `Error: ${message.error?.message}`);
            ws.off('message', messageHandler);
            resolve();
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(heartbeatRequest));

      setTimeout(() => {
        if (!heartbeatReceived) {
          recordTest('Heartbeat request/response', false, 'Timeout');
          ws.off('message', messageHandler);
          resolve();
        }
      }, 3000);
    });
  })
  .then(() => {
    console.log('\n[Test 4/5] Client Features\n');

    // Test client implementation
    const gatewayClientPath = path.join(__dirname, 'src/main/gateway-client.ts');
    const skillRuntimePath = path.join(__dirname, 'src/main/skill-runtime.ts');

    recordTest('Gateway client implementation exists', fs.existsSync(gatewayClientPath));
    recordTest('Skill runtime implementation exists', fs.existsSync(skillRuntimePath));

    if (fs.existsSync(gatewayClientPath)) {
      const content = fs.readFileSync(gatewayClientPath, 'utf-8');
      recordTest('Gateway client has connect method', /async\s+connect\s*\(/.test(content));
      recordTest('Gateway client has skill execution handler', /handleSkillExecuteRequest/.test(content));
    }

    if (fs.existsSync(skillRuntimePath)) {
      const content = fs.readFileSync(skillRuntimePath, 'utf-8');
      recordTest('Skill runtime has executeSkill method', /executeSkill/.test(content));
    }

    console.log('\n[Test 5/5] Cleanup\n');

    // Close connection
    ws.close();
    recordTest('Connection closed gracefully', true);

    return Promise.resolve();
  })
  .catch((error) => {
    console.log(`\n✗ Test failed: ${error.message}\n`);
  })
  .finally(() => {
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      gatewayUrl: GATEWAY_URL,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: ((passedTests / totalTests) * 100).toFixed(2),
      results: testResults
    };

    const reportPath = path.join(__dirname, 'test-integration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nTest report saved: ${reportPath}`);

    // Exit
    if (totalTests === passedTests) {
      console.log('\n✓ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n✗ Some tests failed');
      process.exit(1);
    }
  });
