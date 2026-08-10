const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function updateRecords() {
  try {
    // 1. Update SSC CGL (Allows Final Year)
    const ssc = await prisma.recruitment.findFirst({ where: { postName: { contains: 'SSC CGL' } } });
    if (ssc) {
      await prisma.eligibilityRule.update({
        where: { recruitmentId: ssc.id },
        data: {
          qualificationCutoffDate: new Date('2026-08-01T00:00:00Z'),
          allowsFinalYear: true
        }
      });
      console.log('Updated SSC CGL');
    }

    // 2. Update IBPS IT Officer (Does NOT Allow Final Year)
    const ibps = await prisma.recruitment.findFirst({ where: { postName: { contains: 'IT Officer' } } });
    if (ibps) {
      await prisma.eligibilityRule.update({
        where: { recruitmentId: ibps.id },
        data: {
          qualificationCutoffDate: new Date('2024-08-21T00:00:00Z'),
          allowsFinalYear: false
        }
      });
      console.log('Updated IBPS');
    }
    
    // 3. Update the Profile to be May 2027
    await prisma.profile.update({
      where: { id: 1 },
      data: {
        graduationYear: 2027,
        graduationMonth: 5
      }
    });
    console.log('Updated Profile to May 2027');
    
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

updateRecords();
