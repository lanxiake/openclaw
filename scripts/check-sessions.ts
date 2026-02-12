import { config } from "dotenv";
import { getDatabase } from "../src/db/connection.js";

config();

const db = getDatabase();
const result = await db.execute(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name IN ('admin_sessions', 'user_sessions')
  ORDER BY table_name, ordinal_position
`);
console.log("sessions表结构:");
for (const row of result) {
  console.log(`${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
}
