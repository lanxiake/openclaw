import { config } from 'dotenv'
import { getDatabase } from '../src/db/connection.js'

// 加载环境变量
config()

async function checkSchema() {
  console.log('检查数据库当前schema...')

  try {
    const db = getDatabase()

    // 检查admins表的failed_login_attempts列类型
    const adminsColumn = await db.execute(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'admins'
        AND column_name = 'failed_login_attempts'
    `)
    console.log('\\nadmins.failed_login_attempts:', adminsColumn)

    // 检查payment_orders表是否有plan_id列
    const planIdColumn = await db.execute(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payment_orders'
        AND column_name = 'plan_id'
    `)
    console.log('\\npayment_orders.plan_id:', planIdColumn)

    // 检查user_sessions表是否有device_id列
    const deviceIdColumn = await db.execute(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_sessions'
        AND column_name = 'device_id'
    `)
    console.log('\\nuser_sessions.device_id:', deviceIdColumn)

    // 检查export_logs表的file_size和download_count列类型
    const exportLogsColumns = await db.execute(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'export_logs'
        AND column_name IN ('file_size', 'download_count')
      ORDER BY column_name
    `)
    console.log('\\nexport_logs columns:', exportLogsColumns)

    // 检查verification_codes表的attempts列类型
    const attemptsColumn = await db.execute(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'verification_codes'
        AND column_name = 'attempts'
    `)
    console.log('\\nverification_codes.attempts:', attemptsColumn)

    console.log('\\n✅ Schema检查完成!')
  } catch (error) {
    console.error('❌ Schema检查失败:', error)
    process.exit(1)
  }
}

checkSchema()
