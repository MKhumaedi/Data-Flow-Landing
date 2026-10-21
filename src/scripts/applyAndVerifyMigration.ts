import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

    const targetTables = ['users', 'datasets', 'dashboards', 'dashboard_templates', 'refresh_tokens'];

    console.log('\n--- PRE-MIGRATION CHECK ---');
    for (const table of targetTables) {
      const res = await client.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = 'deletedAt'`,
        [table]
      );
      if (res.rows.length > 0) {
        console.log(`Table "${table}": deletedAt exists (${res.rows[0].data_type})`);
      } else {
        console.log(`Table "${table}": deletedAt DOES NOT EXIST`);
      }
    }

    console.log('\n--- APPLYING MIGRATION SQL ---');
    const migrationSqlPath = path.resolve(__dirname, '../../prisma/migrations/20240820000000_add_soft_delete/migration.sql');
    let sql = '';
    if (fs.existsSync(migrationSqlPath)) {
      sql = fs.readFileSync(migrationSqlPath, 'utf8');
    } else {
      sql = `
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
        ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
        ALTER TABLE "dashboard_templates" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
        ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
        ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
      `;
    }

    console.log('Executing SQL statements:\n' + sql);
    await client.query(sql);
    console.log('SQL Migration executed successfully.');

    // Also check if _prisma_migrations table exists and record the migration if applicable
    try {
      const prismaMigrationsCheck = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
         )`
      );
      if (prismaMigrationsCheck.rows[0]?.exists) {
        const migrationId = '20240820000000_add_soft_delete';
        const alreadyRecorded = await client.query(
          `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
          [migrationId]
        );
        if (alreadyRecorded.rows.length === 0) {
          await client.query(
            `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
             VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
            ['c8d0e720-3b60-4f57-b08e-324d081fbb49', 'manual_migration_hash', migrationId]
          );
          console.log(`Recorded migration "${migrationId}" in _prisma_migrations.`);
        }
      }
    } catch (e: any) {
      console.log('Note on _prisma_migrations record:', e.message);
    }

    console.log('\n--- POST-MIGRATION VERIFICATION (LIVE DATABASE) ---');
    const results: Record<string, any> = {};
    for (const table of targetTables) {
      const res = await client.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = 'deletedAt'`,
        [table]
      );
      if (res.rows.length > 0) {
        results[table] = {
          exists: true,
          column_name: res.rows[0].column_name,
          data_type: res.rows[0].data_type,
          is_nullable: res.rows[0].is_nullable,
        };
        console.log(`✅ Table "${table}": column "deletedAt" VERIFIED (type: ${res.rows[0].data_type}, nullable: ${res.rows[0].is_nullable})`);
      } else {
        results[table] = { exists: false };
        console.log(`❌ Table "${table}": column "deletedAt" MISSING!`);
      }
    }

    console.log('\n--- ALL COLUMNS IN USERS TABLE ---');
    const userCols = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'users' 
       ORDER BY ordinal_position`
    );
    console.table(userCols.rows);

  } catch (err: any) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
