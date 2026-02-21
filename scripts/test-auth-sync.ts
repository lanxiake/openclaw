/**
 * 测试 auth-profile DB store 加载脚本
 *
 * 验证 Agent 运行时从数据库直接读取 auth profiles 的能力。
 */
import "dotenv/config";
import { getDatabase } from "../src/db/connection.js";
import { sql } from "drizzle-orm";
import { loadDbAuthProfileStore } from "../src/agents/auth-profiles/db-store.js";
import { loadAllDatabaseConfigs } from "../src/gateway/config-loader.js";

async function main() {
  console.log("=== Auth Profile DB Store Test ===");

  // 1. 检查数据库连接
  console.log("\n1. Testing DB connection...");
  try {
    const db = getDatabase();
    await db.execute(sql`SELECT 1 as test`);
    console.log("   DB connection OK");
  } catch (e) {
    console.error("   DB connection FAILED:", e);
    process.exit(1);
  }

  // 2. 查询 auth_profiles
  console.log("\n2. Querying auth_profiles...");
  const db = getDatabase();
  const profiles = await db.execute(
    sql`SELECT profile_id, provider, credential_mode, enabled, api_key IS NOT NULL as has_api_key FROM auth_profiles`,
  );
  console.log("   Found profiles:", JSON.stringify(profiles, null, 2));

  // 3. 加载完整配置
  console.log("\n3. Loading all DB configs...");
  const dbConfigs = await loadAllDatabaseConfigs();
  if (!dbConfigs) {
    console.error("   loadAllDatabaseConfigs returned null!");
    process.exit(1);
  }
  console.log("   Auth profiles:", dbConfigs.authProfiles.length);
  console.log("   Auth profile orders:", dbConfigs.authProfileOrders.length);
  console.log(
    "   Profiles detail:",
    dbConfigs.authProfiles.map((p) => ({
      profileId: p.profileId,
      provider: p.provider,
      mode: p.credentialMode,
      enabled: p.enabled,
      hasApiKey: !!p.apiKey,
    })),
  );

  // 4. 测试 loadDbAuthProfileStore（系统级，无 userId）
  console.log("\n4. Loading DB auth profile store (system level)...");
  try {
    const systemStore = await loadDbAuthProfileStore();
    if (systemStore) {
      console.log("   System store profile keys:", Object.keys(systemStore.profiles));
      for (const [k, v] of Object.entries(systemStore.profiles)) {
        console.log(`   - ${k}: type=${v.type}, provider=${v.provider}`);
      }
      if (systemStore.order) {
        console.log("   Order:", JSON.stringify(systemStore.order));
      }
    } else {
      console.log("   No system-level profiles found in DB");
    }
  } catch (err) {
    console.error("   System store load FAILED:", err);
  }

  // 5. 测试 loadDbAuthProfileStore（带 userId）
  console.log("\n5. Loading DB auth profile store (with userId=default)...");
  try {
    const userStore = await loadDbAuthProfileStore("default");
    if (userStore) {
      console.log("   User store profile keys:", Object.keys(userStore.profiles));
    } else {
      console.log("   No user-level profiles found in DB");
    }
  } catch (err) {
    console.error("   User store load FAILED:", err);
  }

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
