const cron = require('node-cron');
const prisma = require('./lib/prisma');
const { exec } = require('child_process');
const path = require('path');

function initCronJobs() {
  // Only run cron locally (Vercel uses API routes for cron)
  if (process.env.VERCEL) {
    console.log('[CRON] Running on Vercel — skipping local cron.');
    return;
  }

  console.log('[CRON] Background tasks initialized (local mode).');

  // Run scrapers every 30 minutes locally
  cron.schedule('*/30 * * * *', () => {
    console.log('[CRON] Running scheduled scrapers at', new Date().toISOString());
    const runPath = path.join(__dirname, '../scraper-local/run.js');
    exec(`node ${runPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('[CRON] Scraper error:', error.message);
      }
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });
  });
}

module.exports = { initCronJobs };
