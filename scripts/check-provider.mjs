#!/usr/bin/env node
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgresql://localhost:5432/mtbot");

try {
  const providers = await sql`
    SELECT id, provider_key, user_id, created_at
    FROM model_providers
    WHERE provider_key = 'test-openai'
  `;

  console.log("Existing providers with key 'test-openai':");
  console.log(JSON.stringify(providers, null, 2));

  if (providers.length > 0) {
    console.log("\n⚠️  Provider already exists! This explains the CREATE failure.");
  } else {
    console.log("\n✅ No existing provider found. The issue is elsewhere.");
  }
} catch (error) {
  console.error("Error querying database:", error);
} finally {
  await sql.end();
}
