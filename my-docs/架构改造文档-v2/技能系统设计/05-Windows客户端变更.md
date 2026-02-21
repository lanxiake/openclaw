# Phase 3: Windows 客户端变更

## 1. 修改 useSkillStore.ts

文件: `apps/windows/src/renderer/hooks/useSkillStore.ts`

### 接通安装/卸载

当前 hook 已有 `installSkill` 和 `uninstallSkill` 方法签名，但调用的是 REST API stub。
需要确认调用路径并接通真实后端:

```typescript
/** 安装技能 - 调用 REST API */
async function installSkill(skillId: string): Promise<InstallResult> {
  // 调用 POST /api/store/skills/:id/install
  const result = await window.electronAPI.api.installStoreSkill(skillId);

  if (result.success && result.downloadUrl) {
    // 下载技能包到本地 (V1: 明文存储)
    await downloadAndSavePackage(skillId, result.downloadUrl);
  }

  // 刷新已安装列表
  await refreshInstalledSkills();
  return result;
}

/** 卸载技能 */
async function uninstallSkill(skillId: string): Promise<void> {
  // 调用 DELETE /api/store/skills/:id/install
  await window.electronAPI.api.uninstallStoreSkill(skillId);

  // 删除本地包文件 (如有)
  await removeLocalPackage(skillId);

  // 刷新列表
  await refreshInstalledSkills();
}
```

### 新增已安装列表查询

```typescript
/** 获取已安装技能列表 */
async function getInstalledSkills(): Promise<InstalledSkill[]> {
  return window.electronAPI.api.getInstalledSkills();
}
```

## 2. UI 组件变更

### SkillStoreView.tsx

- 安装按钮: 已安装显示"已安装"灰色标签 + "卸载"按钮; 未安装显示"安装"按钮
- 安装进度: 点击安装后显示 loading 状态
- 已安装标签页: 增加"已安装"筛选视图

### SkillsView.tsx (如有)

- 系统技能显示锁定图标，不可编辑/删除
- 用户技能显示正常操作按钮

## 3. device-service.ts 扩展

在 `apps/windows/src/renderer/services/device-service.ts` 中可能需要新增:

```typescript
/** 安装商店技能 (REST) */
installStoreSkill(skillId: string): Promise<InstallResult>

/** 卸载商店技能 (REST) */
uninstallStoreSkill(skillId: string): Promise<void>

/** 获取已安装技能列表 (REST) */
getInstalledSkills(): Promise<InstalledSkill[]>

/** 下载技能包 (REST) */
downloadSkillPackage(skillId: string): Promise<ArrayBuffer>
```

## 4. Preload / IPC

V1 不需要新增 IPC 通道。所有操作通过 REST API 完成，由 renderer 进程直接发起 HTTP 请求。

V2 加密后需要 IPC:

- `electronAPI.crypto.generateKeyPair` — V2
- `electronAPI.wasm.store/load/delete` — V2
