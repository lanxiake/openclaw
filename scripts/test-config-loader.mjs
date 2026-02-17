/**
 * 测试 Gateway 配置加载器
 */

import { loadGatewayConfig, validateGatewayConfig } from '../dist/gateway/config-loader.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Gateway 配置加载器测试');
  console.log('='.repeat(60));

  try {
    // 测试1: 加载默认配置
    console.log('\n[测试1] 加载默认配置 (无数据库,无环境变量)');
    const config1 = await loadGatewayConfig();
    console.log(JSON.stringify(config1, null, 2));

    // 验证配置
    const validation1 = validateGatewayConfig(config1);
    console.log('\n配置验证:', validation1.valid ? '✅ 通过' : '❌ 失败');
    if (!validation1.valid) {
      console.log('错误:', validation1.errors);
    }

    // 测试2: 使用环境变量
    console.log('\n[测试2] 使用环境变量覆盖配置');
    process.env.GATEWAY_PORT = '19000';
    process.env.GATEWAY_AUTH_MODE = 'none';

    const config2 = await loadGatewayConfig();
    console.log(JSON.stringify(config2, null, 2));

    // 测试3: 模拟租户配置
    console.log('\n[测试3] 加载租户配置 (需要数据库)');
    try {
      const config3 = await loadGatewayConfig('user_test_123');
      console.log(JSON.stringify(config3, null, 2));
    } catch (error) {
      console.log('⚠️  数据库未连接,跳过租户配置测试');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试完成');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main();
