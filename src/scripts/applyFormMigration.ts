import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function run() {
  if (!connectionString) {
    console.log('Notice: DATABASE_URL not set in env, skipping PostgreSQL direct migration (in-memory mode active).');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL / Supabase successfully.');

    console.log('\n--- CREATING form_templates TABLE (IF NOT EXISTS) ---');
    const sql = `
      CREATE TABLE IF NOT EXISTS "form_templates" (
        "id" TEXT PRIMARY KEY,
        "slug" TEXT NOT NULL UNIQUE,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "fields" JSONB NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isPublished" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP(3)
      );

      CREATE INDEX IF NOT EXISTS "form_templates_slug_idx" ON "form_templates"("slug");
      CREATE INDEX IF NOT EXISTS "form_templates_category_idx" ON "form_templates"("category");
      CREATE INDEX IF NOT EXISTS "form_templates_order_idx" ON "form_templates"("order");
    `;

    await client.query(sql);
    console.log('SQL Migration for form_templates executed successfully.');

    console.log('\n--- VERIFYING form_templates TABLE ---');
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'form_templates'
       ORDER BY ordinal_position`
    );
    console.log(`Table "form_templates" columns count: ${res.rows.length}`);
    console.table(res.rows);
  } catch (err: any) {
    console.warn('Migration warning/skipped (fallback will be used):', err.message);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

run();
