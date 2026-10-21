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

    console.log('\n--- APPLYING AD INVENTORY MIGRATION SQL ---');
    const migrationSqlPath = path.resolve(__dirname, '../../prisma/migrations/20240820020000_add_ad_placements_and_bookings/migration.sql');
    let sql = '';
    if (fs.existsSync(migrationSqlPath)) {
      sql = fs.readFileSync(migrationSqlPath, 'utf8');
    } else {
      sql = `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN 
            CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED'); 
          END IF; 
        END $$;

        CREATE TABLE IF NOT EXISTS "ad_placements" (
            "id" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "description" TEXT,
            "dimensions" TEXT NOT NULL,
            "pricePerWeek" DECIMAL(12,2) NOT NULL,
            "pricePerMonth" DECIMAL(12,2) NOT NULL,
            "hiddenForPremium" BOOLEAN NOT NULL DEFAULT true,
            "isAvailable" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "ad_placements_key_key" ON "ad_placements"("key");

        CREATE TABLE IF NOT EXISTS "ad_bookings" (
            "id" TEXT NOT NULL,
            "placementId" TEXT NOT NULL,
            "advertiserName" TEXT NOT NULL,
            "advertiserContact" TEXT,
            "type" TEXT NOT NULL,
            "imageUrl" TEXT,
            "linkUrl" TEXT,
            "scriptCode" TEXT,
            "startDate" TIMESTAMP(3) NOT NULL,
            "endDate" TIMESTAMP(3) NOT NULL,
            "pricePaid" DECIMAL(12,2) NOT NULL,
            "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ad_bookings_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "ad_bookings_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );

        CREATE INDEX IF NOT EXISTS "ad_bookings_placementId_idx" ON "ad_bookings"("placementId");
      `;
    }

    console.log('Executing SQL statements:\n' + sql);
    await client.query(sql);
    console.log('Ad inventory migration SQL executed successfully.');

    // Seed initial 3 AdPlacements
    console.log('\n--- SEEDING INITIAL AD PLACEMENTS ---');
    const initialPlacements = [
      {
        id: 'cl_placement_sidebar_right',
        key: 'formula_sidebar_right',
        label: 'Sidebar Kanan Halaman Rumus',
        description: 'Banner vertikal di sidebar kanan halaman detail & belajar rumus Excel/Sheets',
        dimensions: '300x600',
        pricePerWeek: 150000.00,
        pricePerMonth: 500000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_formula_inline',
        key: 'formula_inline',
        label: 'Banner Inline Halaman Rumus',
        description: 'Banner horizontal native antara penjelasan rumus dan tabel latihan interaktif',
        dimensions: '728x150',
        pricePerWeek: 100000.00,
        pricePerMonth: 350000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_dashboard_bottom',
        key: 'dashboard_bottom',
        label: 'Banner Bawah Dashboard User',
        description: 'Banner horizontal di bagian bawah halaman daftar dashboard pengguna',
        dimensions: '728x90',
        pricePerWeek: 75000.00,
        pricePerMonth: 250000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_blog_sidebar_right',
        key: 'blog_sidebar_right',
        label: 'Sidebar Kanan Blog',
        description: 'Banner vertikal di sidebar kanan halaman daftar artikel & baca blog',
        dimensions: '300x600',
        pricePerWeek: 150000.00,
        pricePerMonth: 500000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_blog_sidebar_left',
        key: 'blog_sidebar_left',
        label: 'Sidebar Kiri Blog',
        description: 'Banner vertikal di sidebar kiri halaman blog pada layar desktop lebar (1440px+)',
        dimensions: '300x600',
        pricePerWeek: 150000.00,
        pricePerMonth: 500000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_blog_top_banner',
        key: 'blog_top_banner',
        label: 'Banner Atas Blog',
        description: 'Banner horizontal utama di bagian atas halaman artikel blog',
        dimensions: '728x90',
        pricePerWeek: 120000.00,
        pricePerMonth: 400000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
      {
        id: 'cl_placement_blog_bottom_banner',
        key: 'blog_bottom_banner',
        label: 'Banner Bawah Blog',
        description: 'Banner horizontal di bagian bawah setelah konten artikel & rekomendasi',
        dimensions: '728x90',
        pricePerWeek: 90000.00,
        pricePerMonth: 300000.00,
        hiddenForPremium: true,
        isAvailable: true,
      },
    ];

    for (const p of initialPlacements) {
      await client.query(
        `INSERT INTO "ad_placements" ("id", "key", "label", "description", "dimensions", "pricePerWeek", "pricePerMonth", "hiddenForPremium", "isAvailable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT ("key") DO UPDATE SET
           "label" = EXCLUDED."label",
           "description" = EXCLUDED."description",
           "dimensions" = EXCLUDED."dimensions",
           "pricePerWeek" = EXCLUDED."pricePerWeek",
           "pricePerMonth" = EXCLUDED."pricePerMonth",
           "hiddenForPremium" = EXCLUDED."hiddenForPremium",
           "isAvailable" = EXCLUDED."isAvailable",
           "updatedAt" = NOW()`,
        [p.id, p.key, p.label, p.description, p.dimensions, p.pricePerWeek, p.pricePerMonth, p.hiddenForPremium, p.isAvailable]
      );
      console.log(`✅ Seeded / updated placement "${p.key}" (${p.label})`);
    }

    console.log('\n--- VERIFYING AD PLACEMENTS TABLE ---');
    const placements = await client.query(`SELECT * FROM "ad_placements" WHERE "deletedAt" IS NULL`);
    console.table(placements.rows);

  } catch (err: any) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
