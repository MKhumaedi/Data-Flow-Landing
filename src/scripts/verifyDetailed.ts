import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function verifyAllPublicTables() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const tables = ['users', 'datasets', 'dashboards', 'dashboard_templates', 'refresh_tokens'];

    console.log('=== DETAILED PUBLIC SCHEMA LIVE COLUMN VERIFICATION ===');
    
    for (const tableName of tables) {
      const res = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' 
           AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      console.log(`\nTable "public.${tableName}" (Total columns: ${res.rows.length}):`);
      console.table(res.rows);

      const deletedAtCol = res.rows.find((r: any) => r.column_name === 'deletedAt');
      if (deletedAtCol) {
        console.log(`=> [PASS] "deletedAt" is present in public.${tableName} (type: ${deletedAtCol.data_type}, nullable: ${deletedAtCol.is_nullable})`);
      } else {
        console.error(`=> [FAIL] "deletedAt" NOT FOUND in public.${tableName}`);
        process.exit(1);
      }
    }

    console.log('\n=== LIVE TEST QUERY: SELECT deletedAt FROM ALL TABLES ===');
    for (const tableName of tables) {
      const queryRes = await client.query(`SELECT "deletedAt" FROM public."${tableName}" LIMIT 1`);
      console.log(`Query "SELECT deletedAt FROM public.${tableName} LIMIT 1" succeeded. Rows returned: ${queryRes.rows.length}`);
    }

    console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
  } catch (err: any) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyAllPublicTables();
