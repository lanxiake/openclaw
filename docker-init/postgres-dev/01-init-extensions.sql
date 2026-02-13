-- OpenClaw 开发环境 PostgreSQL 初始化脚本
-- 启用 pgvector 扩展

-- 启用 pgvector 扩展（用于向量搜索）
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用 uuid-ossp 扩展（用于生成 UUID）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 验证扩展已启用
DO $$
BEGIN
  RAISE NOTICE 'PostgreSQL extensions enabled:';
  RAISE NOTICE '  - vector (pgvector)';
  RAISE NOTICE '  - uuid-ossp';
  RAISE NOTICE '  - pg_trgm';
END $$;
