import { config } from 'dotenv'
import { getDatabase } from '../src/db/connection.js'

config()

const db = getDatabase()
const result = await db.execute(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'export_logs'
  ORDER BY ordinal_position
`)
console.log('export_logs表的所有列:')
console.log(result)
