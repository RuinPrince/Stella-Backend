const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const a = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const p = new PrismaClient({ adapter: a });

async function run() {
  // Delete old scraper duplicates (IDs 1,2 have no exam data)
  await p.eligibilityRule.deleteMany({ where: { recruitmentId: { in: [1, 2] } } });
  await p.recruitment.deleteMany({ where: { id: { in: [1, 2] } } });
  console.log('Deleted duplicate IDs 1,2');

  const count = await p.recruitment.count();
  console.log('Remaining:', count, 'opportunities');
  await p.$disconnect();
}
run();
