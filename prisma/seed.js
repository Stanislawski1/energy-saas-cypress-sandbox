const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({});

async function main() {
  console.log('Start seeding...');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: 'password123',
      company: 'Acme Energy Corp',
      invoices: {
        create: [
          { amount: 1500.50, status: 'Paid', date: '2026-05-01' },
          { amount: 1620.00, status: 'Pending', date: '2026-06-01' }
        ]
      }
    }
  });
  console.log(`Created user with id: ${admin.id}`);

  const demo = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      password: 'demo',
      company: 'Global Power Inc',
      invoices: {
        create: [
          { amount: 850.75, status: 'Paid', date: '2026-05-15' }
        ]
      }
    }
  });
  console.log(`Created user with id: ${demo.id}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
