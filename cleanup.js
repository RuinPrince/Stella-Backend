const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function cleanupUndefined() {
  try {
    const records = await prisma.recruitment.findMany({
      where: { recruitmentName: { contains: 'undefined' } }
    });
    
    for (const r of records) {
      // Replace undefined with empty string
      const newName = r.recruitmentName.replace('undefined ', '');
      await prisma.recruitment.update({
        where: { id: r.id },
        data: { recruitmentName: newName }
      });
      console.log(`Updated: ${r.recruitmentName} -> ${newName}`);
    }
    
    console.log(`Cleaned up ${records.length} records.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUndefined();
