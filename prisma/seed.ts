import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma';
import { INITIAL_FORMULA_SEEDS } from '../src/features/formulas/formula.seed';

dotenv.config();

const SALT_ROUNDS = 10;

export type SeedRole = 'FREE' | 'PREMIUM' | 'SUPERADMIN';

interface SeedAccount {
  email: string;
  name: string;
  role: SeedRole;
  envKey: string;
  password?: string;
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: 'superadmin@maystudio.id',
    name: 'Super Admin',
    role: 'SUPERADMIN',
    envKey: 'SEED_ADMIN_PASSWORD',
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  {
    email: 'bagus@gmail.com',
    name: 'Bagus (Free User)',
    role: 'FREE',
    envKey: 'SEED_FREE_USER_PASSWORD',
    password: process.env.SEED_FREE_USER_PASSWORD,
  },
  {
    email: 'edi@gmail.com',
    name: 'Edi (Premium User)',
    role: 'PREMIUM',
    envKey: 'SEED_PREMIUM_USER_PASSWORD',
    password: process.env.SEED_PREMIUM_USER_PASSWORD || 'User123',
  },
  {
    email: 'edikhumaedi233@gmail.com',
    name: 'Edi Khumaedi',
    role: 'PREMIUM',
    envKey: 'SEED_PREMIUM_USER_PASSWORD',
    password: process.env.SEED_PREMIUM_USER_PASSWORD || 'User123',
  },
];

async function seedUser(account: SeedAccount): Promise<void> {
  if (!account.password || account.password.trim() === '') {
    throw new Error(
      `[Seed Error] Missing environment variable ${account.envKey}. ` +
      `Please configure ${account.envKey} in your .env file before running seed.`
    );
  }

  const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

  if (prisma?.user?.upsert) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role as any,
        passwordHash,
      },
      create: {
        email: account.email,
        name: account.name,
        role: account.role as any,
        passwordHash,
      },
    });
  }

  console.log(`✓ Seeded user: ${account.email} with role [${account.role}]`);
}

async function seedFormulas(): Promise<void> {
  console.log(`🌱 Seeding ${INITIAL_FORMULA_SEEDS.length} Excel formulas...`);
  let count = 0;

  for (const item of INITIAL_FORMULA_SEEDS) {
    if (prisma?.formula?.upsert) {
      await prisma.formula.upsert({
        where: { slug: item.slug },
        update: {
          name: item.name,
          category: item.category,
          shortDesc: item.shortDesc,
          fullExplanation: item.fullExplanation,
          syntaxExample: item.syntaxExample,
          practiceData: item.practiceData as any,
          order: item.order,
          isPublished: item.isPublished,
        },
        create: {
          slug: item.slug,
          name: item.name,
          category: item.category,
          shortDesc: item.shortDesc,
          fullExplanation: item.fullExplanation,
          syntaxExample: item.syntaxExample,
          practiceData: item.practiceData as any,
          order: item.order,
          isPublished: item.isPublished,
        },
      });
      count++;
    }
  }

  console.log(`✓ Seeded ${count} formulas in database.`);
}

async function seedAdPlacements(): Promise<void> {
  console.log('🌱 Seeding initial AdPlacements...');
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
  ];

  let count = 0;
  for (const p of initialPlacements) {
    if (prisma?.adPlacement?.upsert) {
      await prisma.adPlacement.upsert({
        where: { key: p.key },
        update: {
          label: p.label,
          description: p.description,
          dimensions: p.dimensions,
          pricePerWeek: p.pricePerWeek,
          pricePerMonth: p.pricePerMonth,
          hiddenForPremium: p.hiddenForPremium,
          isAvailable: p.isAvailable,
        },
        create: p,
      });
      count++;
    }
  }
  console.log(`✓ Seeded ${count} ad placements in database.`);
}

async function main(): Promise<void> {
  console.log('🌱 Starting MayStudio database seeding (development only)...');

  for (const account of ACCOUNTS) {
    await seedUser(account);
  }

  await seedFormulas();
  await seedAdPlacements();

  console.log('✅ Database seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma?.$disconnect) {
      await prisma.$disconnect();
    }
  });

