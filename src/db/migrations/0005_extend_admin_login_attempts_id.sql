-- 补充迁移脚本：扩展 admin_login_attempts 表的 id 列长度

-- 将 id 列从 varchar(32) 扩展到 varchar(64)
ALTER TABLE "admin_login_attempts" ALTER COLUMN "id" TYPE varchar(64);
