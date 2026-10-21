import { prisma } from '../lib/prisma';

async function verify() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('--- USERS IN DATABASE ---');
    console.log(`Total count: ${users.length}`);
    for (const u of users) {
      console.log(`- Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
    }
  } catch (err: any) {
    console.error('Query error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
