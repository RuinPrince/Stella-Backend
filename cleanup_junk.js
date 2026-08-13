const prisma = require('./src/lib/prisma');

async function cleanupSkeletons() {
  try {
    // 1. Fix "Not specified" basicPay → null
    const notSpecifiedRecords = await prisma.recruitment.findMany({
      where: { basicPay: 'Not specified' }
    });
    
    for (const r of notSpecifiedRecords) {
      await prisma.recruitment.update({
        where: { id: r.id },
        data: { basicPay: null }
      });
    }
    console.log(`[1/3] Fixed ${notSpecifiedRecords.length} "Not specified" basicPay records → null`);

    // 2. Fix generic placeholder descriptions
    const placeholderRecords = await prisma.recruitment.findMany({
      where: {
        OR: [
          { description: { startsWith: 'Please refer to the official' } },
          { description: { startsWith: 'Source: ' } },
          { description: { startsWith: 'Source: Notification' } },
        ]
      }
    });
    
    for (const r of placeholderRecords) {
      await prisma.recruitment.update({
        where: { id: r.id },
        data: { description: null }
      });
    }
    console.log(`[2/3] Cleared ${placeholderRecords.length} placeholder descriptions → null`);

    // 3. Delete duplicate/junk skeleton records that have NO useful data at all
    const allRecords = await prisma.recruitment.findMany({
      include: { eligibilityRule: true, exam: true }
    });

    let deletedCount = 0;
    for (const r of allRecords) {
      const isJunk = !r.basicPay && !r.payScale && !r.grossSalary &&
                     !r.selectionProcess && !r.examPattern &&
                     !r.eligibilityRule && !r.exam &&
                     !r.vacancies && !r.qualificationSummary &&
                     r.verificationStatus === 'NEEDS_VERIFICATION';
      
      if (isJunk) {
        await prisma.recruitment.delete({ where: { id: r.id } });
        console.log(`  Deleted skeleton: [${r.id}] ${r.postName}`);
        deletedCount++;
      }
    }
    console.log(`[3/3] Deleted ${deletedCount} empty skeleton records for re-scraping`);
    
    console.log('\nDone! These records will be re-populated with full details on the next scrape cycle.');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSkeletons();
