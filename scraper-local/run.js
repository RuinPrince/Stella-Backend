const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { notifyDeadline, notifyNewOpportunity, notifyImportantUpdate } = require('../src/services/notificationService');

// Use the same connection string as Vercel
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[LOCAL SCRAPER] Error: DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const { processOpportunityLifecycle } = require('../src/services/opportunityLifecycle');
async function runScrapers() {
  const logFile = path.join(__dirname, 'scraper_log.txt');
  const log = (msg) => {
    const txt = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(txt.trim());
    fs.appendFileSync(logFile, txt);
  };

  log('--- Starting Local Scraper Backup ---');

  try {
    // 1. Fetch active sources from DB
    const sources = await prisma.scraperSource.findMany({
      where: { status: { not: 'UNAVAILABLE' } }
    });
    
    log(`Found ${sources.length} active/pending sources.`);

    for (const src of sources) {
      log(`[${src.category}] Running ${src.name} (${src.adapterName})...`);
      
      // Update lastCheckedAt immediately
      await prisma.scraperSource.update({
        where: { id: src.id },
        data: { lastCheckedAt: new Date() }
      });

      try {
        const adapterPath = path.join(__dirname, `../src/scrapers/${src.adapterName}.js`);
        
        let adapterInstance;

        // Check if the specific adapter file actually exists
        if (fs.existsSync(adapterPath)) {
          const AdapterClass = require(adapterPath);
          adapterInstance = new AdapterClass(prisma);
        } else {
          if (src.category === 'PRIVATE_IT') {
            await prisma.scraperSource.update({ where: { id: src.id }, data: { status: 'UNAVAILABLE' } });
            log(`! ${src.name} disabled: no supported official ATS adapter.`);
            continue;
          }
          // Fallback to Universal Adapter
          log(`  -> Specific adapter not found. Using Universal Adapter...`);
          const UniversalAdapter = require('../src/scrapers/UniversalAdapter');
          adapterInstance = new UniversalAdapter(prisma, src.adapterName, src.name, src.category);
        }

        await adapterInstance.process();
        
        // Success
        await prisma.scraperSource.update({
          where: { id: src.id },
          data: { 
            lastSuccessfulFetchAt: new Date(),
            status: 'ACTIVE' // reset to active if it was needs_attention
          }
        });
        log(`✓ ${src.name} completed successfully.`);

      } catch (err) {
        log(`✗ Failed ${src.name}: ${err.message}`);
        
        // If it fails, mark as NEEDS_ATTENTION
        await prisma.scraperSource.update({
          where: { id: src.id },
          data: { status: 'NEEDS_ATTENTION' }
        });
      }
    }

    // Process Opportunity Lifecycle
    await processOpportunityLifecycle();
    log('Opportunity lifecycle processed.');

  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    log('--- Finished Local Scraper Backup ---\n');
  }
}

runScrapers();
