-- OpenClaw PostgreSQL 初始化脚本
--
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- 用于创建必要的扩展和初始配置
--

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 启用 pg_trgm 扩展 (用于模糊搜索)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 启用 btree_gin 扩展 (用于复合索引)
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 创建只读用户 (可选，用于报表查询)
-- CREATE USER openclaw_readonly WITH PASSWORD 'readonly_password';
-- GRANT CONNECT ON DATABASE openclaw TO openclaw_readonly;
-- GRANT USAGE ON SCHEMA public TO openclaw_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO openclaw_readonly;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO openclaw_readonly;

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE 'OpenClaw database initialized successfully!';
END $$;
