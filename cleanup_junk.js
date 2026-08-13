const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function cleanTitle(str, orgName) {
  let clean = str.replace(/<[^>]*>?/gm, '').replace(/^[>"]+/, '');
  clean = clean.replace(/_/g, ' ').replace(/\.html|\.pdf|\.aspx|\.php/gi, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/\b\w/g, l => l.toUpperCase());
  
  const lower = clean.toLowerCase();
  if (lower === 'recruitment' || lower === 'careers' || lower === 'apply' || clean.length < 3) {
    clean = `${orgName} General Recruitment`;
  }
  
  return clean.substring(0, 100).trim();
}

async function cleanupJunk() {
  try {
    const recruitments = await prisma.recruitment.findMany({
      include: { organization: true }
    });
    
    let updatedCount = 0;

    for (const r of recruitments) {
      const orgName = r.organization?.name || 'Organization';
      const newTitle = cleanTitle(r.postName, orgName);
      
      let newDescription = r.description;
      if (newDescription && newDescription.startsWith('Source: http')) {
        newDescription = 'Please refer to the official source link below for complete details regarding eligibility, compensation, and application procedures.';
      }

      if (newTitle !== r.postName || newDescription !== r.description) {
        await prisma.recruitment.update({
          where: { id: r.id },
          data: {
            postName: newTitle,
            description: newDescription
          }
        });
        console.log(`Updated [${r.id}]:`);
        if (newTitle !== r.postName) console.log(`  Title: ${r.postName} -> ${newTitle}`);
        if (newDescription !== r.description) console.log(`  Description updated.`);
        updatedCount++;
      }
    }
    
    console.log(`\nSuccessfully cleaned ${updatedCount} records.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupJunk();
