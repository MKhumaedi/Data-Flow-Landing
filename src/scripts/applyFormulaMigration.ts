import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function run() {
  if (!connectionString) {
    console.error('Error: Neither DIRECT_URL nor DATABASE_URL is defined in environment.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL / Supabase successfully.');

    console.log('\n--- CREATING TABLES (IF NOT EXISTS) ---');
    const sql = `
      CREATE TABLE IF NOT EXISTS "formulas" (
        "id" TEXT PRIMARY KEY,
        "slug" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "shortDesc" TEXT NOT NULL,
        "fullExplanation" TEXT NOT NULL,
        "syntaxExample" TEXT NOT NULL,
        "practiceData" JSONB NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isPublished" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP(3)
      );

      CREATE INDEX IF NOT EXISTS "formulas_slug_idx" ON "formulas"("slug");
      CREATE INDEX IF NOT EXISTS "formulas_category_idx" ON "formulas"("category");
      CREATE INDEX IF NOT EXISTS "formulas_order_idx" ON "formulas"("order");

      CREATE TABLE IF NOT EXISTS "ad_slots" (
        "id" TEXT PRIMARY KEY,
        "placement" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "imageUrl" TEXT,
        "linkUrl" TEXT,
        "scriptCode" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedBy" TEXT,
        "deletedAt" TIMESTAMP(3)
      );

      CREATE INDEX IF NOT EXISTS "ad_slots_placement_idx" ON "ad_slots"("placement");
    `;

    await client.query(sql);
    console.log('SQL Migration executed successfully.');

    console.log('\n--- VERIFYING TABLES & COLUMNS ---');
    for (const table of ['formulas', 'ad_slots']) {
      const res = await client.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );
      console.log(`\nTable "${table}" columns count: ${res.rows.length}`);
      console.table(res.rows);
    }
  } catch (err: any) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
