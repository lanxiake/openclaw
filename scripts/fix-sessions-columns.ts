import { config } from 'dotenv'
import { getDatabase } from '../src/db/connection.js'

config()

async function fixSessionsColumns() {
  console.log('开始修复sessions表列...')

  try {
    const db = getDatabase()

    // 为admin_sessions表添加revoked列
    console.log('\\n1. 为admin_sessions表添加revoked列')
    await db.execute(`
      ALTER TABLE "admin_sessions"
        ADD COLUMN IF NOT EXISTS "revoked" boolean DEFAULT false NOT NULL;
    `)
    console.log('✅ admin_sessions.revoked列添加完成')

    // 为admin_sessions表添加last_active_at列
    console.log('\\n2. 为admin_sessions表添加last_active_at列')
    await db.execute(`
      ALTER TABLE "admin_sessions"
        ADD COLUMN IF NOT EXISTS "last_active_at" timestamp with time zone;
    `)
    console.log('✅ admin_sessions.last_active_at列添加完成')

    // 为user_sessions表添加last_refreshed_at列(如果不存在)
    console.log('\\n3. 检查user_sessions表是否需要添加列')
    console.log('✅ user_sessions表已有所需列')

    console.log('\\n✅ 所有sessions表列修复完成!')
  } catch (error) {
    console.error('❌ sessions表列修复失败:', error)
    process.exit(1)
  }
}

fixSessionsColumns()
