const cron = require('node-cron');
const prisma = require('./lib/prisma');
const IBPSMockAdapter = require('./scrapers/ibpsMockAdapter');

function initCronJobs() {
  // Only run cron locally (Vercel uses API routes for cron)
  if (process.env.VERCEL) {
    console.log('[CRON] Running on Vercel — skipping local cron.');
    return;
  }

  console.log('[CRON] Background tasks initialized (local mode).');

  // Run scrapers every 30 minutes locally
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running scheduled scrapers at', new Date().toISOString());
    try {
      const ibps = new IBPSMockAdapter(prisma);
      await ibps.process();
    } catch (e) {
      console.error('[CRON] Scraper error:', e.message);
    }
  });
}

module.exports = { initCronJobs };
