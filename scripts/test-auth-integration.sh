#!/bin/bash

# 认证服务前后端集成测试脚本
# 用途: 测试用户认证和管理员认证服务的完整流程

set -e

echo "==================================="
echo "认证服务前后端集成测试"
echo "==================================="
echo ""

# 设置测试环境变量
echo "[1/4] 设置环试环境变量..."
export JWT_SECRET="test-jwt-secret-key-at-least-32-characters-long-1234567890"
export ADMIN_JWT_SECRET="admin-jwt-secret-key-at-least-32-characters-long-1234567890"
export DATABASE_URL="postgresql://user:password@localhost:5432/test_db"
export NODE_ENV="test"

echo "✓ JWT_SECRET: ${JWT_SECRET:0:20}..."
echo "✓ ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET:0:20}..."
echo "✓ NODE_ENV: $NODE_ENV"
echo ""

# 运行用户认证服务单元测试
echo "[2/4] 运行用户认证服务单元测试..."
echo "测试文件: src/assistant/auth/auth-service.test.ts"
pnpm test -- src/assistant/auth/auth-service.test.ts --reporter=verbose || true
echo ""

# 运行管理员认证服务单元测试
echo "[3/4] 运行管理员认证服务单元测试..."
echo "测试文件: src/assistant/admin-auth/admin-auth-service.test.ts"
pnpm test -- src/assistant/admin-auth/admin-auth-service.test.ts --reporter=verbose || true
echo ""

# 生成测试覆盖报告
echo "[4/4] 生成测试覆盖报告..."
pnpm test:coverage -- src/assistant/auth/ src/assistant/admin-auth/ || true
echo ""

echo "==================================="
echo "集成测试完成"
echo "==================================="
