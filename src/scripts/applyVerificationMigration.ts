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

    console.log('\n--- 1. CHECKING EXISTING USERS BEFORE MIGRATION ---');
    const beforeUsers = await client.query(
      `SELECT id, email, name, role, "createdAt" FROM public.users ORDER BY email`
    );
    console.log(`Found ${beforeUsers.rows.length} existing users:`);
    console.table(beforeUsers.rows);

    console.log('\n--- 2. APPLYING MIGRATION SQL (add_verification_status) ---');
    const migrationSqlPath = path.resolve(__dirname, '../../prisma/migrations/20240820010000_add_verification_status/migration.sql');
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    console.log('Executing SQL statements:\n' + sql);
    await client.query(sql);
    console.log('SQL Migration executed successfully.');

    // Record migration in _prisma_migrations if table exists
    try {
      const prismaMigrationsCheck = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
         )`
      );
      if (prismaMigrationsCheck.rows[0]?.exists) {
        const migrationId = '20240820010000_add_verification_status';
        const alreadyRecorded = await client.query(
          `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
          [migrationId]
        );
        if (alreadyRecorded.rows.length === 0) {
          await client.query(
            `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
             VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
            ['e9f1a234-4c71-5d82-c19f-435e192acc50', 'manual_migration_hash_verification', migrationId]
          );
          console.log(`Recorded migration "${migrationId}" in _prisma_migrations.`);
        }
      }
    } catch (e: any) {
      console.log('Note on _prisma_migrations record:', e.message);
    }

    console.log('\n--- 3. LIVE DATABASE SCHEMA VERIFICATION ---');
    const targetCols = ['verificationStatus', 'verifiedAt', 'verifiedBy', 'deletedAt', 'email', 'role'];
    for (const col of targetCols) {
      const res = await client.query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = $1`,
        [col]
      );
      if (res.rows.length > 0) {
        console.log(`✅ Table "users": column "${col}" VERIFIED (type: ${res.rows[0].data_type}, udt: ${res.rows[0].udt_name}, nullable: ${res.rows[0].is_nullable}, default: ${res.rows[0].column_default})`);
      } else {
        console.error(`❌ Table "users": column "${col}" NOT FOUND!`);
        process.exit(1);
      }
    }

    console.log('\n--- 4. CHECKING EXISTING USERS AFTER MIGRATION ---');
    const afterUsers = await client.query(
      `SELECT id, email, name, role, "verificationStatus", "verifiedAt", "verifiedBy", "deletedAt" 
       FROM public.users 
       ORDER BY email`
    );
    console.table(afterUsers.rows);

    console.log('\n=== ALL DATABASE TASKS EXECUTED AND VERIFIED SUCCESSFULLY ===');
  } catch (err: any) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
