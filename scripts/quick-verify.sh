#!/bin/bash
# OpenClaw 快速验证脚本 (Bash)
#
# 用于快速验证项目核心功能
#
# 使用方式:
#   ./scripts/quick-verify.sh              # 完整验证
#   ./scripts/quick-verify.sh --skip-tests # 跳过测试
#   ./scripts/quick-verify.sh --skip-gateway # 跳过网关测试

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# 参数解析
SKIP_TESTS=false
SKIP_GATEWAY=false
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --skip-tests)
            SKIP_TESTS=true
            ;;
        --skip-gateway)
            SKIP_GATEWAY=true
            ;;
        --verbose|-v)
            VERBOSE=true
            ;;
    esac
done

echo ""
echo -e "${CYAN}========================================"
echo "  OpenClaw Quick Verification Script"
echo -e "========================================${NC}"
echo ""

START_TIME=$(date +%s)
PASSED=0
FAILED=0

# 辅助函数
log_step() {
    echo -e "${YELLOW}[...] $1${NC}"
}

log_ok() {
    echo -e "${GREEN}[OK] $1${NC}"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL] $1${NC}"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

log_skip() {
    echo -e "${GRAY}[SKIP] $1${NC}"
    ((PASSED++))
}

# Step 1: 检查 Node.js 版本
log_step "Step 1: Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$MAJOR_VERSION" -ge 22 ]; then
        log_ok "Node.js $NODE_VERSION"
    else
        log_warn "Node.js $NODE_VERSION (requires v22+)"
        ((FAILED++))
    fi
else
    log_fail "Node.js not found"
fi

# Step 2: 检查 pnpm
log_step "Step 2: Checking pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    log_ok "pnpm $PNPM_VERSION"
else
    log_fail "pnpm not found"
fi

# Step 3: 类型检查
log_step "Step 3: Running TypeScript build..."
if pnpm build > /tmp/build.log 2>&1; then
    log_ok "TypeScript build passed"
else
    log_fail "TypeScript build failed"
    if [ "$VERBOSE" = true ]; then
        cat /tmp/build.log
    fi
fi

# Step 4: Lint 检查
log_step "Step 4: Running linter..."
if pnpm lint > /tmp/lint.log 2>&1; then
    log_ok "Lint passed"
else
    log_warn "Lint warnings/errors found"
    ((FAILED++))
    if [ "$VERBOSE" = true ]; then
        cat /tmp/lint.log
    fi
fi

# Step 5: 单元测试
if [ "$SKIP_TESTS" = false ]; then
    log_step "Step 5: Running unit tests..."
    if pnpm test -- --run --reporter=dot > /tmp/test.log 2>&1; then
        log_ok "Unit tests passed"
    else
        log_warn "Some tests failed"
        ((FAILED++))
        if [ "$VERBOSE" = true ]; then
            cat /tmp/test.log
        fi
    fi
else
    log_skip "Step 5: Skipping unit tests"
fi

# Step 6: 网关健康检查
if [ "$SKIP_GATEWAY" = false ]; then
    log_step "Step 6: Testing gateway health..."
    if pnpm openclaw health > /tmp/health.log 2>&1; then
        log_ok "Gateway health check passed"
    else
        log_warn "Gateway health check failed (gateway may not be running)"
        ((FAILED++))
    fi
else
    log_skip "Step 6: Skipping gateway test"
fi

# 汇总结果
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${CYAN}========================================"
echo "  Verification Summary"
echo -e "========================================${NC}"
echo ""
echo -e "Duration: ${GRAY}${DURATION} seconds${NC}"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some checks failed. Review the output above.${NC}"
    exit 1
fi
