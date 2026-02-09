import { config } from 'dotenv'
import { getDatabase } from '../src/db/connection.js'

config()

async function fixForeignKeyColumns() {
  console.log('开始修复外键列长度...')

  try {
    const db = getDatabase()

    // 修复admin_sessions表的外键列
    console.log('\\n1. 修复admin_sessions表外键列')
    await db.execute(`
      ALTER TABLE "admin_sessions"
        ALTER COLUMN "admin_id" TYPE varchar(64);
    `)
    console.log('✅ admin_sessions.admin_id列修复完成')

    // 修复user_sessions表的外键列
    console.log('\\n2. 修复user_sessions表外键列')
    await db.execute(`
      ALTER TABLE "user_sessions"
        ALTER COLUMN "user_id" TYPE varchar(64),
        ALTER COLUMN "device_id" TYPE varchar(64);
    `)
    console.log('✅ user_sessions外键列修复完成')

    // 修复其他表的外键列
    const fkUpdates = [
      { table: 'user_devices', column: 'user_id' },
      { table: 'verification_codes', column: 'user_id' },
      { table: 'login_attempts', column: 'user_id' },
      { table: 'admin_login_attempts', column: 'admin_id' },
      { table: 'audit_logs', column: 'user_id' },
      { table: 'audit_logs', column: 'admin_id' },
      { table: 'export_logs', column: 'admin_id' },
      { table: 'subscriptions', column: 'user_id' },
      { table: 'subscriptions', column: 'plan_id' },
      { table: 'payment_orders', column: 'user_id' },
      { table: 'payment_orders', column: 'subscription_id' },
      { table: 'payment_orders', column: 'plan_id' },
    ]

    for (const { table, column } of fkUpdates) {
      try {
        console.log(`\\n3. 修复${table}.${column}列`)
        await db.execute(`
          ALTER TABLE "${table}"
            ALTER COLUMN "${column}" TYPE varchar(64);
        `)
        console.log(`✅ ${table}.${column}列修复完成`)
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.log(`ℹ️  ${table}.${column}列不存在,跳过`)
        } else {
          console.log(`⚠️  ${table}.${column}列修复失败:`, error.message)
        }
      }
    }

    console.log('\\n✅ 所有外键列长度修复完成!')
  } catch (error) {
    console.error('❌ 外键列修复失败:', error)
    process.exit(1)
  }
}

fixForeignKeyColumns()
