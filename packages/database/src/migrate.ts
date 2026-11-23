import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(__dirname, '../../../.env'), quiet: true });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL es obligatorio');
  console.log('Starting migration...');
  const sql = postgres(connectionString, { max: 1, connect_timeout: 15 });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: resolve(__dirname, '../drizzle') });
    console.log('Migration applied successfully (no seed).');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

runMigration().catch(() => {
  console.error('Migration failed. Check database availability and migration history; seed was not executed.');
  process.exitCode = 1;
});
