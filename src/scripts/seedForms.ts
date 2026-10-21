import { Client } from 'pg';
import { INITIAL_FORM_SEEDS } from '../features/forms/form.seed';

async function seed() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('No DATABASE_URL found.');
    return;
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const item of INITIAL_FORM_SEEDS) {
    await client.query(
      `INSERT INTO "form_templates" ("id", "slug", "category", "title", "description", "fields", "order", "isPublished", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT ("slug") DO UPDATE SET
         "title" = EXCLUDED."title",
         "category" = EXCLUDED."category",
         "description" = EXCLUDED."description",
         "fields" = EXCLUDED."fields",
         "order" = EXCLUDED."order",
         "isPublished" = EXCLUDED."isPublished",
         "updatedAt" = NOW()`,
      [
        item.id,
        item.slug,
        item.category,
        item.title,
        item.description,
        JSON.stringify(item.fields),
        item.order,
        item.isPublished,
      ]
    );
  }

  const res = await client.query('SELECT COUNT(*) FROM "form_templates"');
  console.log(`Seeding complete. Total form templates in database: ${res.rows[0].count}`);
  await client.end();
}

seed().catch(console.error);
