#!/usr/bin/env node
/**
 * 测试模型配置加载器
 */

import { ModelProviderRepository, AgentDefaultConfigRepository } from '../dist/db/repositories/model-configs.js';
import { getDatabase } from '../dist/db/connection.js';

async function testModelConfigLoader() {
  console.log('=== 测试模型配置加载器 ===\n');

  try {
    const db = getDatabase();
    const modelProviderRepo = new ModelProviderRepository(db);
    const agentConfigRepo = new AgentDefaultConfigRepository(db);

    // 1. 测试获取有效的模型提供商列表
    console.log('1. 获取有效的模型提供商列表:');
    const providers = await modelProviderRepo.listEffectiveProviders();
    console.log(`   找到 ${providers.length} 个提供商:`);
    providers.forEach((p) => {
      console.log(`   - ${p.providerKey} (${p.providerName || 'N/A'})`);
      console.log(`     baseUrl: ${p.baseUrl}`);
      console.log(`     enabled: ${p.enabled}`);
      console.log(`     priority: ${p.priority}`);
    });
    console.log('');

    // 2. 测试获取特定提供商
    console.log('2. 获取 custom-anthropic 提供商:');
    const anthropic = await modelProviderRepo.getProviderByKey('custom-anthropic');
    if (anthropic) {
      console.log(`   找到: ${anthropic.providerName}`);
      console.log(`   models: ${JSON.stringify(anthropic.models, null, 2)}`);
    } else {
      console.log('   未找到');
    }
    console.log('');

    // 3. 测试获取 Agent 默认配置
    console.log('3. 获取 Agent 默认配置:');
    const agentConfig = await agentConfigRepo.getEffectiveConfig();
    if (agentConfig) {
      console.log(`   primaryModel: ${agentConfig.primaryModel}`);
      console.log(`   compactionMode: ${agentConfig.compactionMode}`);
      console.log(`   maxConcurrent: ${agentConfig.maxConcurrent}`);
      console.log(`   subagentsMaxConcurrent: ${agentConfig.subagentsMaxConcurrent}`);
    } else {
      console.log('   未找到配置');
    }
    console.log('');

    console.log('✅ 测试完成');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n提示: PostgreSQL 未运行,配置加载器将使用环境变量或默认值');
    }
  }
}

testModelConfigLoader();
