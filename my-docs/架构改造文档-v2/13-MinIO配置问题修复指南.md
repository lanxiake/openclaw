# MinIO 配置问题修复指南

> 解决 E2E 测试中的 MinIO 签名不匹配问题

---

## 问题描述

E2E 测试失败，错误信息：

```
S3Error: The request signature we calculated does not match the signature you provided.
Check your key and signing method.
```

## 根本原因

MinIO 客户端的签名计算与服务器端不匹配，可能的原因：

1. **Access Key / Secret Key 不匹配**
   - 环境变量中的密钥与 MinIO 服务器配置不一致
   - 密钥包含特殊字符未正确转义

2. **端点配置问题**
   - 使用了错误的端口号
   - 使用了 IP 地址而非域名（或反之）

3. **区域配置问题**
   - MinIO 客户端和服务器的区域设置不一致

4. **时间同步问题**
   - 客户端和服务器时间差异过大（超过 15 分钟）

---

## 解决方案

### 方案 1: 验证 MinIO 配置

#### 1.1 检查 MinIO 服务器配置

```bash
# 连接到 MinIO 服务器
ssh user@10.157.152.40

# 检查 MinIO 容器配置
docker exec openclaw-minio env | grep MINIO

# 应该看到:
# MINIO_ROOT_USER=openclaw_minio
# MINIO_ROOT_PASSWORD=Oc@2026!Mn#Secure
```

#### 1.2 验证本地环境变量

检查 `.env` 文件中的配置：

```bash
# 查看当前配置
cat .env | grep MINIO

# 应该匹配服务器配置:
# MINIO_ENDPOINT=10.157.152.40
# MINIO_PORT=22003
# MINIO_ACCESS_KEY=openclaw_minio
# MINIO_SECRET_KEY=Oc@2026!Mn#Secure
```

#### 1.3 测试 MinIO 连接

```bash
# 使用 mc (MinIO Client) 测试连接
docker run --rm -it minio/mc alias set testminio \
  http://10.157.152.40:22003 \
  openclaw_minio \
  'Oc@2026!Mn#Secure'

# 列出存储桶
docker run --rm -it minio/mc ls testminio
```

### 方案 2: 修复密钥中的特殊字符

MinIO 密钥包含特殊字符 `@` 和 `#`，可能导致签名问题。

#### 2.1 更新 MinIO 服务器密钥

编辑 `docker-compose.infra.yml`：

```yaml
minio:
  environment:
    MINIO_ROOT_USER: openclaw_minio
    # 使用不含特殊字符的密钥
    MINIO_ROOT_PASSWORD: Oc2026MnSecure
```

重启 MinIO：

```bash
docker-compose -f docker-compose.infra.yml restart minio
```

#### 2.2 更新本地环境变量

编辑 `.env` 文件：

```bash
MINIO_ACCESS_KEY=openclaw_minio
MINIO_SECRET_KEY=Oc2026MnSecure
```

### 方案 3: 使用环境变量覆盖

在测试环境中使用简单的密钥：

创建 `.env.test` 文件：

```bash
# MinIO 测试配置（使用简单密钥）
MINIO_ENDPOINT=10.157.152.40
MINIO_PORT=22003
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

修改测试配置：

```typescript
// test/setup.ts
import { config } from "dotenv";

// 加载测试环境变量
config({ path: ".env.test", override: true });
```

### 方案 4: 修复 MinIO 客户端配置

#### 4.1 添加区域配置

编辑 `src/infrastructure/minio/connection.ts`：

```typescript
export function getMinioConfigFromEnv(): MinioConfig {
  return {
    endPoint: process.env["MINIO_ENDPOINT"] || "localhost",
    port: parseInt(process.env["MINIO_PORT"] || "9000", 10),
    useSSL: process.env["MINIO_USE_SSL"] === "true",
    accessKey: process.env["MINIO_ACCESS_KEY"] || "openclaw",
    secretKey: process.env["MINIO_SECRET_KEY"] || "openclaw_dev",
    // 添加区域配置
    region: process.env["MINIO_REGION"] || "us-east-1",
  };
}
```

#### 4.2 添加路径样式配置

MinIO 可能需要使用路径样式（path-style）而非虚拟主机样式：

```typescript
export function createMinioClient(config: MinioConfig): Minio.Client {
  const client = new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
    // 强制使用路径样式
    pathStyle: true,
  });

  return client;
}
```

### 方案 5: 重新初始化 MinIO

如果以上方案都不行，重新初始化 MinIO：

```bash
# 1. 停止 MinIO
docker-compose -f docker-compose.infra.yml stop minio

# 2. 删除 MinIO 数据（警告：会丢失所有数据）
docker volume rm openclaw-minio-data

# 3. 重新启动 MinIO
docker-compose -f docker-compose.infra.yml up -d minio

# 4. 等待 MinIO 启动
sleep 10

# 5. 初始化存储桶
docker-compose -f docker-compose.infra.yml up minio-init
```

---

## 推荐方案

**最简单且最安全的方案：使用不含特殊字符的密钥**

### 步骤 1: 更新服务器配置

```bash
# SSH 到服务器
ssh user@10.157.152.40

# 编辑 docker-compose.infra.yml
nano docker-compose.infra.yml

# 修改 MinIO 密钥
# MINIO_ROOT_PASSWORD: Oc2026MnSecure  # 移除特殊字符

# 重启 MinIO
docker-compose -f docker-compose.infra.yml restart minio
```

### 步骤 2: 更新本地配置

```bash
# 编辑 .env 文件
nano .env

# 修改密钥
# MINIO_SECRET_KEY=Oc2026MnSecure

# 重新运行测试
pnpm test:e2e
```

---

## 验证修复

### 1. 测试 MinIO 连接

```bash
# 创建测试脚本
cat > test-minio.js << 'EOF'
import * as Minio from 'minio';

const client = new Minio.Client({
  endPoint: '10.157.152.40',
  port: 22003,
  useSSL: false,
  accessKey: 'openclaw_minio',
  secretKey: 'Oc2026MnSecure',
  region: 'us-east-1',
});

async function test() {
  try {
    const buckets = await client.listBuckets();
    console.log('✓ MinIO 连接成功');
    console.log('存储桶列表:', buckets.map(b => b.name));
  } catch (error) {
    console.error('✗ MinIO 连接失败:', error.message);
  }
}

test();
EOF

# 运行测试
node test-minio.js
```

### 2. 运行 E2E 测试

```bash
# 运行技能上传测试
pnpm vitest run src/assistant/skills/skill-upload-review.e2e.test.ts --config vitest.e2e.config.ts

# 应该看到:
# ✓ 完整流程：创建 → 上传 → 审核 → 发布
# ✓ 审核拒绝流程
```

### 3. 手动测试上传

```bash
# 使用 mc 客户端测试上传
docker run --rm -it \
  -v $(pwd):/data \
  minio/mc \
  cp /data/README.md \
  testminio/openclaw-skills/test-upload.md

# 验证文件已上传
docker run --rm -it minio/mc ls testminio/openclaw-skills/
```

---

## 常见问题

### Q1: 修改密钥后仍然失败

**A**: 清除 MinIO 客户端缓存：

```bash
# 删除 node_modules 重新安装
rm -rf node_modules
pnpm install

# 重启测试
pnpm test:e2e
```

### Q2: 时间同步问题

**A**: 检查服务器时间：

```bash
# 检查本地时间
date

# 检查服务器时间
ssh user@10.157.152.40 date

# 如果时间差异超过 15 分钟，同步时间
sudo ntpdate -u time.nist.gov
```

### Q3: 防火墙阻止连接

**A**: 检查防火墙规则：

```bash
# 检查端口是否开放
telnet 10.157.152.40 22003

# 如果连接失败，在服务器上开放端口
sudo ufw allow 22003/tcp
```

---

## 最终配置示例

### .env 文件

```bash
# MinIO 配置（生产环境）
MINIO_ENDPOINT=10.157.152.40
MINIO_PORT=22003
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=openclaw_minio
MINIO_SECRET_KEY=Oc2026MnSecure
MINIO_REGION=us-east-1
```

### docker-compose.infra.yml

```yaml
minio:
  image: minio/minio:latest
  container_name: openclaw-minio
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: openclaw_minio
    MINIO_ROOT_PASSWORD: Oc2026MnSecure
    MINIO_REGION: us-east-1
  ports:
    - "22003:9000"
    - "22004:9001"
  volumes:
    - minio-data:/data
```

---

## 总结

1. **首选方案**: 使用不含特殊字符的密钥（`Oc2026MnSecure`）
2. **添加配置**: 明确指定区域（`us-east-1`）和路径样式（`pathStyle: true`）
3. **验证连接**: 使用 mc 客户端测试连接
4. **运行测试**: 确认 E2E 测试通过

修复后，所有 MinIO 相关的测试应该都能通过。
