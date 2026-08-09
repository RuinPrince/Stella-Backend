const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/sources - Get all scraper sources grouped by category
router.get('/', async (req, res) => {
  try {
    const sources = await prisma.scraperSource.findMany({
      orderBy: { name: 'asc' }
    });

    // We can group them by category for the frontend
    const grouped = {
      GOVERNMENT: [],
      BANKING: [],
      PSU: [],
      PRIVATE_IT: []
    };

    let activeCount = 0;
    let attentionCount = 0;
    let unavailableCount = 0;

    sources.forEach(src => {
      if (grouped[src.category]) {
        grouped[src.category].push(src);
      } else {
        grouped[src.category] = [src];
      }

      if (src.status === 'ACTIVE') activeCount++;
      else if (src.status === 'NEEDS_ATTENTION') attentionCount++;
      else if (src.status === 'UNAVAILABLE') unavailableCount++;
    });

    res.json({
      summary: {
        activeCount,
        attentionCount,
        unavailableCount,
        total: sources.length
      },
      sources: grouped
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

module.exports = router;
