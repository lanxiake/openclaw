import { config } from 'dotenv';
import postgres from 'postgres';

config();

async function fixIdLength() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  console.log('🔧 修复 admin_audit_logs.id 列长度...\n');
  
  try {
    await sql`ALTER TABLE admin_audit_logs ALTER COLUMN id TYPE varchar(64)`;
    console.log('✅ 已将 id 列长度从 32 扩展到 64\n');
    
    // 验证
    const result = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'admin_audit_logs' AND column_name = 'id'
    `;
    
    console.log('📋 修复后:', result[0]);
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixIdLength();
