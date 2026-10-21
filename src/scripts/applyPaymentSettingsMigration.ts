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
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully.');

    console.log('\n--- APPLYING PAYMENT SYSTEM MIGRATION SQL ---');
    const migrationSqlPath = path.resolve(__dirname, '../../prisma/migrations/20240820040000_add_payment_system_management/migration.sql');
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    console.log('Executing SQL statements...');
    await client.query(sql);
    console.log('SQL Migration executed successfully.');

    // Check tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('payment_gateway_configs', 'manual_payment_accounts')
    `);
    console.log('\nCreated tables:', tablesCheck.rows.map(r => r.table_name));

    // Check seeded records
    const configs = await client.query(`SELECT * FROM "payment_gateway_configs" ORDER BY "gateway"`);
    console.log('\nSeeded Gateway Configs:');
    console.table(configs.rows);

    console.log('\nMigration and verification completed successfully!');
  } catch (err: any) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end().catch(() => null);
  }
}

run();
