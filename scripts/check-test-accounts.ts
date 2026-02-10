import { config } from 'dotenv';
import postgres from 'postgres';

config();

async function checkAccounts() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  console.log('📋 检查测试账户...\n');
  
  // 检查测试用户
  const users = await sql`
    SELECT id, email, phone, display_name, is_active 
    FROM users 
    WHERE email = 'test@example.com' OR phone = '+8613800138000'
  `;
  
  console.log('👤 测试用户:');
  if (users.length > 0) {
    users.forEach(u => {
      console.log(`  ✅ ${u.email || u.phone} - ${u.display_name} (${u.is_active ? '激活' : '未激活'})`);
    });
  } else {
    console.log('  ❌ 未找到测试用户');
  }
  
  // 检查测试管理员
  const admins = await sql`
    SELECT id, username, display_name, role, status 
    FROM admins 
    WHERE username = 'admin' OR username = 'testadmin'
  `;
  
  console.log('\n👨‍💼 测试管理员:');
  if (admins.length > 0) {
    admins.forEach(a => {
      console.log(`  ✅ ${a.username} - ${a.display_name} (${a.role}, ${a.status})`);
    });
  } else {
    console.log('  ❌ 未找到测试管理员');
  }
  
  console.log('\n📝 测试账号信息:');
  console.log('  用户邮箱: test@example.com');
  console.log('  用户手机: +8613800138000');
  console.log('  用户密码: TestP@ssw0rd123');
  console.log('  管理员用户名: admin');
  console.log('  管理员密码: Admin@123456\n');
  
  await sql.end();
}

checkAccounts();
