/**
 * End-to-End Integration Test
 * Complete test of Windows Client and Gateway integration
 */

const WebSocket = require('ws');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const GATEWAY_URL = 'ws://127.0.0.1:18789';
const TEST_TIMEOUT = 15000;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Windows Client & Gateway End-to-End Integration Test  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const testResults = {
  timestamp: new Date().toISOString(),
  gatewayUrl: GATEWAY_URL,
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  }
};

function recordTest(category, name, status, details = '') {
  const result = { category, name, status, details, timestamp: new Date().toISOString() };
  testResults.tests.push(result);
  testResults.summary.total++;

  if (status === 'PASS') {
    testResults.summary.passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else if (status === 'FAIL') {
    testResults.summary.failed++;
    console.log(`  ✗ [FAIL] ${name}`);
  } else if (status === 'SKIP') {
    testResults.summary.skipped++;
    console.log(`  ⊘ [SKIP] ${name}`);
  }

  if (details) {
    console.log(`    ${details}`);
  }
}

async function runTests() {
  try {
    // Test Suite 1: Gateway Health Check
    console.log('\n[Test Suite 1/6] Gateway Health Check');
    console.log('─────────────────────────────────────\n');

    try {
      const { stdout } = await execPromise('pnpm openclaw gateway health --json', {
        timeout: 10000,
        cwd: process.cwd().replace(/apps[\\\/]windows.*/, '')
      });

      const health = JSON.parse(stdout.split('\n').filter(line => line.trim().startsWith('{')).join(''));

      recordTest('Gateway', 'Health check responds', health.ok ? 'PASS' : 'FAIL',
        health.ok ? `Response time: ${health.durationMs}ms` : 'Health check failed');

      recordTest('Gateway', 'Channels configured',
        health.channels && Object.keys(health.channels).length > 0 ? 'PASS' : 'FAIL',
        `Channels: ${Object.keys(health.channels || {}).join(', ')}`);

      recordTest('Gateway', 'Agents configured',
        health.agents && health.agents.length > 0 ? 'PASS' : 'FAIL',
        `Agents: ${health.agents?.length || 0}`);

    } catch (error) {
      recordTest('Gateway', 'Health check responds', 'FAIL', `Error: ${error.message}`);
    }

    // Test Suite 2: WebSocket Connection
    console.log('\n[Test Suite 2/6] WebSocket Connection');
    console.log('─────────────────────────────────────\n');

    await new Promise((resolve) => {
      const startTime = Date.now();
      const ws = new WebSocket(GATEWAY_URL);
      let connected = false;
      let challengeReceived = false;

      ws.on('open', () => {
        connected = true;
        const connectTime = Date.now() - startTime;
        recordTest('Connection', 'WebSocket connection established', 'PASS', `Time: ${connectTime}ms`);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'event' && message.event === 'connect.challenge') {
            challengeReceived = true;
            recordTest('Connection', 'Received connect.challenge', 'PASS', `Nonce: ${message.payload?.nonce?.substring(0, 8)}...`);

            // Send connect request
            const connectRequest = {
              type: 'req',
              id: `e2e-test-${Date.now()}`,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'gateway-client',
                  displayName: 'E2E Test Client',
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
            recordTest('Connection', 'Sent connect request', 'PASS');
          }

          if (message.type === 'res') {
            if (message.ok) {
              recordTest('Connection', 'Handshake completed', 'PASS', `Protocol: ${message.payload?.protocol || 'N/A'}`);

              // Test heartbeat
              const heartbeatRequest = {
                type: 'req',
                id: `heartbeat-${Date.now()}`,
                method: 'heartbeat',
                params: { ts: Date.now() }
              };
              ws.send(JSON.stringify(heartbeatRequest));

            } else {
              recordTest('Connection', 'Handshake completed', 'FAIL', `Error: ${message.error?.message || 'Unknown'}`);
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      });

      ws.on('error', (error) => {
        if (!connected) {
          recordTest('Connection', 'WebSocket connection established', 'FAIL', `Error: ${error.message}`);
        }
      });

      ws.on('close', () => {
        if (!connected) {
          recordTest('Connection', 'WebSocket connection established', 'FAIL', 'Connection closed before open');
        }
        if (connected && !challengeReceived) {
          recordTest('Connection', 'Received connect.challenge', 'FAIL', 'No challenge received');
        }
        resolve();
      });

      setTimeout(() => {
        ws.close();
        resolve();
      }, 5000);
    });

    // Test Suite 3: Client Implementation
    console.log('\n[Test Suite 3/6] Client Implementation');
    console.log('─────────────────────────────────────\n');

    const fs = require('fs');
    const path = require('path');

    const gatewayClientPath = path.join(__dirname, 'src/main/gateway-client.ts');
    const skillRuntimePath = path.join(__dirname, 'src/main/skill-runtime.ts');
    const mainIndexPath = path.join(__dirname, 'src/main/index.ts');

    if (fs.existsSync(gatewayClientPath)) {
      const content = fs.readFileSync(gatewayClientPath, 'utf-8');

      recordTest('Implementation', 'GatewayClient class exists',
        /class\s+GatewayClient/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Implementation', 'Connect method implemented',
        /async\s+connect\s*\(/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Implementation', 'Disconnect method implemented',
        /async\s+disconnect\s*\(/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Implementation', 'Skill execution handler',
        /handleSkillExecuteRequest/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Implementation', 'Event emitter integration',
        /EventEmitter/.test(content) ? 'PASS' : 'FAIL');
    } else {
      recordTest('Implementation', 'GatewayClient file exists', 'FAIL');
    }

    if (fs.existsSync(skillRuntimePath)) {
      const content = fs.readFileSync(skillRuntimePath, 'utf-8');

      recordTest('Implementation', 'SkillRuntime class exists',
        /class\s+ClientSkillRuntime/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Implementation', 'ExecuteSkill method implemented',
        /executeSkill/.test(content) ? 'PASS' : 'FAIL');
    } else {
      recordTest('Implementation', 'SkillRuntime file exists', 'FAIL');
    }

    // Test Suite 4: Protocol Compliance
    console.log('\n[Test Suite 4/6] Protocol Compliance');
    console.log('─────────────────────────────────────\n');

    if (fs.existsSync(gatewayClientPath)) {
      const content = fs.readFileSync(gatewayClientPath, 'utf-8');

      recordTest('Protocol', 'Message type definitions',
        /type.*MessageType.*=.*['"]req['"].*\|.*['"]res['"].*\|.*['"]event['"]/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Protocol', 'Connect params structure',
        /minProtocol.*maxProtocol.*client/.test(content) ? 'PASS' : 'FAIL');

      recordTest('Protocol', 'Skill execution types',
        /SkillExecuteRequest.*SkillExecuteResult/.test(content) ? 'PASS' : 'FAIL');
    }

    // Test Suite 5: Build System
    console.log('\n[Test Suite 5/6] Build System');
    console.log('─────────────────────────────────────\n');

    const outPath = path.join(__dirname, 'out');
    recordTest('Build', 'Build output exists', fs.existsSync(outPath) ? 'PASS' : 'FAIL');

    if (fs.existsSync(outPath)) {
      recordTest('Build', 'Main process compiled',
        fs.existsSync(path.join(outPath, 'main')) ? 'PASS' : 'FAIL');

      recordTest('Build', 'Preload script compiled',
        fs.existsSync(path.join(outPath, 'preload')) ? 'PASS' : 'FAIL');

      recordTest('Build', 'Renderer process compiled',
        fs.existsSync(path.join(outPath, 'renderer')) ? 'PASS' : 'FAIL');
    }

    // Test Suite 6: Dependencies
    console.log('\n[Test Suite 6/6] Dependencies');
    console.log('─────────────────────────────────────\n');

    const packageJson = require('./package.json');

    recordTest('Dependencies', 'ws module',
      packageJson.dependencies?.ws ? 'PASS' : 'FAIL',
      packageJson.dependencies?.ws || 'Not found');

    recordTest('Dependencies', 'electron',
      packageJson.devDependencies?.electron ? 'PASS' : 'FAIL',
      packageJson.devDependencies?.electron || 'Not found');

    recordTest('Dependencies', 'electron-updater',
      packageJson.dependencies?.['electron-updater'] ? 'PASS' : 'FAIL',
      packageJson.dependencies?.['electron-updater'] || 'Not found');

    const wsInstalled = fs.existsSync(path.join(__dirname, 'node_modules/ws'));
    recordTest('Dependencies', 'ws module installed', wsInstalled ? 'PASS' : 'FAIL');

  } catch (error) {
    console.error(`\n✗ Test execution error: ${error.message}`);
  }

  // Final Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`Total Tests:   ${testResults.summary.total}`);
  console.log(`Passed:        ${testResults.summary.passed} ✓`);
  console.log(`Failed:        ${testResults.summary.failed} ✗`);
  console.log(`Skipped:       ${testResults.summary.skipped} ⊘`);

  const passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(2);
  console.log(`Pass Rate:     ${passRate}%`);

  // Save report
  const fs = require('fs');
  const reportPath = require('path').join(__dirname, 'e2e-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed report saved: ${reportPath}`);

  // Exit code
  if (testResults.summary.failed === 0) {
    console.log('\n✓ All tests passed!\n');
    process.exit(0);
  } else {
    console.log(`\n✗ ${testResults.summary.failed} test(s) failed\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
