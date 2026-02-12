import { config } from "dotenv";
import { getDatabase } from "../src/db/connection.js";

config();

const db = getDatabase();
const result = await db.execute(`
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name = 'id'
`);
console.log("users.id列信息:");
console.log(result);
