-- 修改 model_providers 表的字段类型
ALTER TABLE model_providers
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text,
  ALTER COLUMN created_by TYPE text,
  ALTER COLUMN updated_by TYPE text;

-- 修改 agent_configs 表的字段类型
ALTER TABLE agent_configs
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text,
  ALTER COLUMN created_by TYPE text,
  ALTER COLUMN updated_by TYPE text;

-- 修改 gateway_configs 表的字段类型
ALTER TABLE gateway_configs
  ALTER COLUMN id TYPE text,
  ALTER COLUMN user_id TYPE text,
  ALTER COLUMN created_by TYPE text,
  ALTER COLUMN updated_by TYPE text;
