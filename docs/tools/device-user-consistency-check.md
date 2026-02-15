# 数据一致性检查工具

## 功能说明

检查 `user_devices` 表和 `device-pairing.json` 文件之间的数据一致性,并提供自动修复功能。

## 检测的问题类型

1. **missing_in_pairing**: 设备在数据库中存在,但在 device-pairing 中不存在
2. **missing_in_db**: 设备在 device-pairing 中有 userId,但在数据库中不存在
3. **user_id_mismatch**: 设备的 userId 在两个数据源中不一致
4. **orphaned_device**: 设备关联的用户在数据库中不存在

## 使用方法

### 仅检查(不修复)

```bash
tsx scripts/check-device-user-consistency.ts
```

### 检查并修复

```bash
tsx scripts/check-device-user-consistency.ts --fix
```

执行修复时会提示确认,输入 `yes` 或 `y` 确认修复。

### 指定 device-pairing 目录

```bash
tsx scripts/check-device-user-consistency.ts --base-dir=/path/to/data
```

## 修复策略

工具以 `device-pairing.json` 为权威数据源:

- **missing_in_pairing**: 从数据库中删除该设备记录
- **missing_in_db**: 从 device-pairing 同步到数据库
- **user_id_mismatch**: 以 device-pairing 的 userId 为准更新数据库
- **orphaned_device**: 从数据库中删除该设备记录

## 输出示例

### 一致性检查通过

```
开始检查数据一致性...

加载 device-pairing 数据...
找到 5 个已配对设备

加载数据库中的 user_devices 数据...
找到 5 条 user_devices 记录

检查 user_devices 中的设备...
检查 device-pairing 中的设备...
检查孤立的 user_devices 记录...

========== 数据一致性检查报告 ==========

数据库中的设备数: 5
device-pairing 中的设备数: 5
发现的问题数: 0

✅ 数据一致性检查通过,未发现问题!

========================================
```

### 发现问题

```
========== 数据一致性检查报告 ==========

数据库中的设备数: 3
device-pairing 中的设备数: 2
发现的问题数: 2

❌ 发现以下问题:

【设备在数据库中但不在 device-pairing 中】(1 个)
  - 设备 device-001 在 user_devices 表中存在,但在 device-pairing 中不存在

【userId 不匹配】(1 个)
  - 设备 device-002 的 userId 不匹配: DB=user-1, Pairing=user-2

========================================
```

## 注意事项

1. 修复操作会直接修改数据库,建议先备份数据
2. 修复前会提示确认,请仔细检查报告
3. 修复完成后会自动重新检查一致性
4. 工具以 device-pairing 为权威数据源,确保 device-pairing 数据正确

## 测试

运行单元测试:

```bash
pnpm vitest run src/scripts/check-device-user-consistency.test.ts
```

测试覆盖:
- 报告打印功能
- 各种问题类型的修复逻辑
- 多问题批量处理
