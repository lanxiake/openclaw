/**
 * 手动UI测试脚本
 * 用于验证Windows客户端与网关的实际交互
 *
 * 正确的握手流程：
 * 1. 建立 WebSocket 连接
 * 2. 等待 connect.challenge 事件
 * 3. 发送 connect 请求（使用正确的参数格式）
 * 4. 等待 connect 响应完成握手
 */

const WebSocket = require('ws');

const GATEWAY_URL = 'ws://127.0.0.1:18789';
const PROTOCOL_VERSION = 3;

console.log('='.repeat(60));
console.log('Windows客户端手动UI测试');
console.log('='.repeat(60));
console.log();

// 测试1: 验证网关连接
console.log('测试1: 验证网关连接和握手流程');
console.log('-'.repeat(60));

const ws = new WebSocket(GATEWAY_URL);
let connectNonce = null;
let handshakeComplete = false;

ws.on('open', () => {
  console.log('✓ WebSocket连接已建立，等待 connect.challenge 事件...');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('← 收到消息:', JSON.stringify(message, null, 2));

    // 步骤1: 处理 connect.challenge 事件
    if (message.type === 'event' && message.event === 'connect.challenge') {
      connectNonce = message.payload.nonce;
      console.log('✓ 收到 connect.challenge，nonce:', connectNonce);
      console.log();

      // 步骤2: 发送 connect 请求（使用正确的参数格式）
      console.log('测试2: 发送 connect 请求完成握手');
      console.log('-'.repeat(60));

      const connectMessage = {
        type: 'req',
        id: 'test-connect-' + Date.now(),
        method: 'connect',
        params: {
          minProtocol: PROTOCOL_VERSION,
          maxProtocol: PROTOCOL_VERSION,
          client: {
            id: 'gateway-client',
            displayName: 'OpenClaw Windows Test',
            version: '0.1.0',
            platform: 'win32',
            mode: 'ui'
          },
          caps: [
            'skill.local',
            'file.ops',
            'system.cmd'
          ]
        }
      };

      console.log('→ 发送 connect 请求:', JSON.stringify(connectMessage, null, 2));
      ws.send(JSON.stringify(connectMessage));
      return;
    }

    // 步骤3: 处理 connect 响应
    if (message.type === 'res' && message.id && message.id.startsWith('test-connect-')) {
      if (message.ok) {
        handshakeComplete = true;
        console.log('✓ 握手完成！');
        console.log('  会话信息:', JSON.stringify(message.payload, null, 2));
        console.log();

        // 测试3: 发送心跳
        console.log('测试3: 发送心跳消息');
        console.log('-'.repeat(60));

        const heartbeatMessage = {
          type: 'req',
          id: 'test-heartbeat-' + Date.now(),
          method: 'heartbeat',
          params: {}
        };

        console.log('→ 发送心跳:', JSON.stringify(heartbeatMessage, null, 2));
        ws.send(JSON.stringify(heartbeatMessage));
      } else {
        console.error('✗ 握手失败:', message.error);
        ws.close();
        process.exit(1);
      }
      return;
    }

    // 步骤4: 处理心跳响应
    if (message.type === 'res' && message.id && message.id.startsWith('test-heartbeat-')) {
      if (message.ok) {
        console.log('✓ 心跳响应成功');
        console.log();

        // 测试4: 测试技能执行
        console.log('测试4: 请求执行技能');
        console.log('-'.repeat(60));

        const skillMessage = {
          type: 'req',
          id: 'test-skill-' + Date.now(),
          method: 'skill.execute',
          params: {
            skill: 'system',
            action: 'echo',
            args: {
              message: 'Hello from Gateway!'
            }
          }
        };

        console.log('→ 发送技能执行请求:', JSON.stringify(skillMessage, null, 2));
        ws.send(JSON.stringify(skillMessage));
      } else {
        console.error('✗ 心跳失败:', message.error);
      }
      return;
    }

    // 步骤5: 处理技能执行响应
    if (message.type === 'res' && message.id && message.id.startsWith('test-skill-')) {
      if (message.ok) {
        console.log('✓ 技能执行成功');
        console.log('  结果:', JSON.stringify(message.payload, null, 2));
      } else {
        console.log('⚠ 技能执行失败（可能是预期的）:', message.error);
      }
      console.log();

      // 测试完成
      console.log('='.repeat(60));
      console.log('测试完成！');
      console.log('='.repeat(60));
      console.log();
      console.log('测试总结:');
      console.log('  ✓ WebSocket连接成功');
      console.log('  ✓ 握手流程完成');
      console.log('  ✓ 心跳消息正常');
      console.log('  ✓ 技能执行测试完成');
      console.log();

      // 等待1秒后关闭连接
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
      return;
    }

    // 处理其他事件
    if (message.type === 'event') {
      console.log('← 收到事件:', message.event);
    }

  } catch (error) {
    console.error('✗ 解析消息失败:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('✗ WebSocket错误:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`连接已关闭 (code: ${code}, reason: ${reason || 'n/a'})`);
  if (!handshakeComplete) {
    console.error('✗ 握手未完成就断开连接');
    process.exit(1);
  }
});

// 超时保护
setTimeout(() => {
  console.error('✗ 测试超时');
  ws.close();
  process.exit(1);
}, 15000);
