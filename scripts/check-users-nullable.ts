import { config } from 'dotenv'
import { getDatabase } from '../src/db/connection.js'

config()

const db = getDatabase()
const result = await db.execute(`
  SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name IN ('phone', 'email')
  ORDER BY column_name
`)
console.log('users表phone和email列信息:')
console.log(result)
