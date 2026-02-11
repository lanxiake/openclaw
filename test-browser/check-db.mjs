/**
 * 清理登录失败记录，解除账户锁定
 */
import postgres from 'postgres';

const DATABASE_URL = 'postgresql://openclaw_admin:Oc%402026!Pg%23Secure@10.157.152.40:22001/openclaw_prod';

const sql = postgres(DATABASE_URL, {
  connect_timeout: 10,
  idle_timeout: 5,
});

try {
  console.log('清理登录失败记录...');

  // 查看当前失败记录
  const attempts = await sql`SELECT count(*)::int as total FROM admin_login_attempts WHERE success = false`;
  console.log(`当前失败登录记录: ${attempts[0].total}`);

  // 删除所有失败记录
  const deleted = await sql`DELETE FROM admin_login_attempts WHERE success = false RETURNING id`;
  console.log(`已删除 ${deleted.length} 条失败记录`);

  // 检查 admin 用户状态（正确的列名: failed_login_attempts, locked_until, status）
  const admins = await sql`SELECT username, status, failed_login_attempts, locked_until FROM admins WHERE username = 'admin'`;
  console.log('admin 用户状态:', JSON.stringify(admins[0], null, 2));

  // 解锁 admin 用户（重置 status + failed_login_attempts + locked_until）
  if (admins[0]?.status === 'locked' || admins[0]?.locked_until || Number(admins[0]?.failed_login_attempts) > 0) {
    await sql`UPDATE admins SET status = 'active', failed_login_attempts = '0', locked_until = NULL, updated_at = NOW() WHERE username = 'admin'`;
    console.log('已解锁 admin 用户（status→active, failed_login_attempts→0, locked_until→NULL）');
  }

  console.log('清理完成');
} catch (err) {
  console.error('数据库错误:', err.message);
} finally {
  await sql.end();
  process.exit(0);
}
