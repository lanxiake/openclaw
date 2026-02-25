# Phase 1：积分参数与系统配置更新

> 影响最小、风险最低的纯数值调整

## 变更文件清单

| 文件                                      | 变更说明                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `src/assistant/credits/credit-service.ts` | 更新 3 个默认常量                                   |
| `src/assistant/config/config-service.ts`  | 更新 initializeDefaultConfigs 默认值 + 新增限制配置 |

## Task 1.1：更新 CreditService 默认常量

### 文件：`src/assistant/credits/credit-service.ts`

定位：第 137-144 行

```typescript
// ===== 修改前 =====
const DEFAULT_REGISTER_BONUS = 300;
const DEFAULT_INVITE_BONUS = 200;
const DEFAULT_INVITE_MAX = 2000;
const DEFAULT_EXPIRY_MONTHS = 3; // 不变

// ===== 修改后 =====
const DEFAULT_REGISTER_BONUS = 600;
const DEFAULT_INVITE_BONUS = 300;
const DEFAULT_INVITE_MAX = 3000;
const DEFAULT_EXPIRY_MONTHS = 3; // 不变
```

### 关联影响

- `grantRegistrationBonus()` 默认赠送 600
- `grantInviteReward()` 默认每次奖励 300，上限 3000
- 这些方法支持 `options` 参数覆盖默认值，不会破坏已有调用

## Task 1.2：更新系统配置默认值

### 文件：`src/assistant/config/config-service.ts`

定位：`initializeDefaultConfigs()` 函数（第 524 行起）

#### 积分配置（修改默认值）

```typescript
// credits.register_bonus: 300 → 600
{
  key: CONFIG_KEYS.CREDITS_REGISTER_BONUS,
  value: 600,                    // ← 改为 600
  valueType: "number",
  group: CONFIG_GROUPS.CREDITS,
  description: "注册赠送积分数",
  defaultValue: 600,             // ← 改为 600
  validationRules: { min: 0, max: 10000 },
},

// credits.invite_bonus: 200 → 300
{
  key: CONFIG_KEYS.CREDITS_INVITE_BONUS,
  value: 300,                    // ← 改为 300
  valueType: "number",
  group: CONFIG_GROUPS.CREDITS,
  description: "每次邀请奖励积分数",
  defaultValue: 300,             // ← 改为 300
  validationRules: { min: 0, max: 10000 },
},

// credits.invite_max: 2000 → 3000
{
  key: CONFIG_KEYS.CREDITS_INVITE_MAX,
  value: 3000,                   // ← 改为 3000
  valueType: "number",
  group: CONFIG_GROUPS.CREDITS,
  description: "邀请积分总上限",
  defaultValue: 3000,            // ← 改为 3000
  validationRules: { min: 0, max: 100000 },
},
```

#### 用户限制配置（修改 + 新增）

```typescript
// limits.max_devices: 2 → 5
{
  key: CONFIG_KEYS.LIMITS_MAX_DEVICES,
  value: 5,                      // ← 改为 5
  valueType: "number",
  group: CONFIG_GROUPS.LIMITS,
  description: "用户最大绑定设备数（所有用户统一）",
  defaultValue: 5,               // ← 改为 5
  validationRules: { min: 1, max: 50 },
},

// ===== 新增 =====
{
  key: CONFIG_KEYS.LIMITS_MAX_SKILLS,
  value: 100,
  valueType: "number",
  group: CONFIG_GROUPS.LIMITS,
  description: "用户最大技能安装数（所有用户统一）",
  defaultValue: 100,
  validationRules: { min: 1, max: 1000 },
},
{
  key: CONFIG_KEYS.LIMITS_MAX_FILE_SIZE_MB,
  value: 50,
  valueType: "number",
  group: CONFIG_GROUPS.LIMITS,
  description: "用户单文件上传大小限制(MB)（所有用户统一）",
  defaultValue: 50,
  validationRules: { min: 1, max: 500 },
},
```

## 验证步骤

```bash
# 1. 确认常量修改
grep -n "DEFAULT_REGISTER_BONUS\|DEFAULT_INVITE_BONUS\|DEFAULT_INVITE_MAX" \
  src/assistant/credits/credit-service.ts

# 2. 确认配置默认值
grep -n "credits.register_bonus\|credits.invite_bonus\|credits.invite_max" \
  src/assistant/config/config-service.ts

# 3. 编译检查
pnpm build

# 4. 运行测试
pnpm test
```

## 注意事项

- **已有部署**：`system_configs` 表中的值不会被自动更新（`initializeDefaultConfigs` 只写入不存在的配置）。需手动执行 SQL 或通过 Admin Console 更新。
- **向下兼容**：所有方法的 `options` 参数可覆盖默认值，不影响已有调用。
