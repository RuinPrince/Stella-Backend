const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const IBPSMockAdapter = require('../src/scrapers/ibpsMockAdapter');
const { notifyDeadline, notifyNewOpportunity, notifyImportantUpdate } = require('../src/services/notificationService');

// Use the same connection string as Vercel
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[LOCAL SCRAPER] Error: DATABASE_URL not found in .env');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function checkDeadlines() {
  console.log('[LOCAL SCRAPER] Checking deadlines...');
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
  
  const closingSoon = await prisma.recruitment.findMany({
    where: { 
      applicationEndDate: { gte: now, lte: threeDaysFromNow },
      status: 'OPEN' 
    }
  });

  for (const opp of closingSoon) {
    const daysLeft = Math.ceil((opp.applicationEndDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    console.log(`[DEADLINE ALERT] ${opp.postName} closes in ${daysLeft} days!`);
    notifyDeadline(opp, daysLeft);
    
    await prisma.recruitment.update({
      where: { id: opp.id },
      data: { status: 'CLOSING_SOON' }
    });
  }
}

async function runScrapers() {
  const logFile = path.join(__dirname, 'scraper_log.txt');
  const log = (msg) => {
    const txt = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(txt.trim());
    fs.appendFileSync(logFile, txt);
  };

  log('--- Starting Local Scraper Backup ---');

  try {
    // Run IBPS Scraper
    const ibps = new IBPSMockAdapter(prisma);
    await ibps.process();
    log('IBPS scraping completed successfully.');
    
    // Add other scrapers here later (SSC, RRB, etc.)

    // Check deadlines
    await checkDeadlines();
    log('Deadline checks completed.');

  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    log('--- Finished Local Scraper Backup ---\n');
  }
}

runScrapers();
