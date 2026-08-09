const express = require('express');
const cors = require('cors');
require('dotenv').config();

const prisma = require('./lib/prisma');

const { checkEligibility } = require('./services/eligibilityEngine');
const { calculatePriority } = require('./services/priorityEngine');
const { calculateReadiness } = require('./services/preparationEngine');
const { generateDailyPlan } = require('./services/studyPlanGenerator');

const syllabusRoutes = require('./routes/syllabus');
const preparationRoutes = require('./routes/preparation');
const applicationRoutes = require('./routes/applications');
const organizationRoutes = require('./routes/organizations');
const sourcesRoutes = require('./routes/sources');
const { initCronJobs } = require('./cron');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// API Endpoints
// ==========================================

app.use('/api/sources', sourcesRoutes);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Profile ---
app.get('/api/profile', async (req, res) => {
  try {
    let profile = await prisma.profile.findFirst();
    if (!profile) {
      profile = await prisma.profile.create({ data: {} });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const data = req.body;
    let profile = await prisma.profile.findFirst();
    if (profile) {
      profile = await prisma.profile.update({ where: { id: profile.id }, data });
    } else {
      profile = await prisma.profile.create({ data });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Organizations ---
app.get('/api/organizations', async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany();
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/organizations', async (req, res) => {
  try {
    const org = await prisma.organization.create({ data: req.body });
    res.json(org);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Recruitments / Opportunities ---
app.get('/api/opportunities', async (req, res) => {
  try {
    const { sector, eligibility, minSalary, status: statusFilter, search, sort } = req.query;

    const profile = await prisma.profile.findFirst();
    let opportunities = await prisma.recruitment.findMany({
      include: {
        organization: true,
        eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true } } } } } },
        applicationTracker: true,
      }
    });

    opportunities = opportunities.map(opp => {
      const computedElig = checkEligibility(profile, opp.eligibilityRule);
      const priority = calculatePriority(opp, computedElig, profile);
      let readiness = 0;
      if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
      return { ...opp, computedEligibility: computedElig, computedPriority: priority, readiness };
    });

    if (search) {
      const s = search.toLowerCase();
      opportunities = opportunities.filter(o =>
        o.recruitmentName.toLowerCase().includes(s) || o.postName.toLowerCase().includes(s) ||
        o.organization?.name.toLowerCase().includes(s) || (o.description || '').toLowerCase().includes(s)
      );
    }
    if (sector) { opportunities = opportunities.filter(o => (o.sector || o.organization?.sector || '').toLowerCase() === sector.toLowerCase()); }
    if (eligibility) { opportunities = opportunities.filter(o => o.computedEligibility === eligibility); }
    if (statusFilter) { opportunities = opportunities.filter(o => o.status === statusFilter); }
    if (minSalary) {
      const minVal = parseInt(minSalary);
      opportunities = opportunities.filter(o => {
        const match = (o.basicPay || o.grossSalary || o.ctc || '').replace(/[^0-9]/g, '');
        return match && parseInt(match) >= minVal;
      });
    }

    if (sort === 'deadline') {
      opportunities.sort((a, b) => (a.applicationEndDate ? new Date(a.applicationEndDate).getTime() : Infinity) - (b.applicationEndDate ? new Date(b.applicationEndDate).getTime() : Infinity));
    } else if (sort === 'salary') {
      opportunities.sort((a, b) => parseInt((b.basicPay || '0').replace(/[^0-9]/g, '')) - parseInt((a.basicPay || '0').replace(/[^0-9]/g, '')));
    } else {
      opportunities.sort((a, b) => b.computedPriority - a.computedPriority);
    }

    res.json(opportunities);
  } catch (error) {
    console.error('[API] /api/opportunities error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/opportunities/:id', async (req, res) => {
  try {
    const profile = await prisma.profile.findFirst();
    const opp = await prisma.recruitment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        organization: true, eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true, subject: true } } } } } },
        applicationTracker: true,
      }
    });
    if (!opp) return res.status(404).json({ error: "Not found" });
    const elig = checkEligibility(profile, opp.eligibilityRule);
    const priority = calculatePriority(opp, elig, profile);
    let readiness = 0;
    if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
    res.json({ ...opp, computedEligibility: elig, computedPriority: priority, readiness });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/opportunities', async (req, res) => {
  try {
    const opp = await prisma.recruitment.create({ data: req.body, include: { organization: true } });
    res.json(opp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/opportunities/:id', async (req, res) => {
  try {
    const opp = await prisma.recruitment.update({ where: { id: parseInt(req.params.id) }, data: req.body, include: { organization: true } });
    res.json(opp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Application Tracker ---
app.get('/api/applications', async (req, res) => {
  try {
    const apps = await prisma.applicationTracker.findMany({ include: { recruitment: { include: { organization: true } } } });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { recruitmentId, applicationStatus, notes } = req.body;
    let tracker = await prisma.applicationTracker.findUnique({ where: { recruitmentId } });
    if (tracker) { tracker = await prisma.applicationTracker.update({ where: { recruitmentId }, data: { applicationStatus, notes } }); }
    else { tracker = await prisma.applicationTracker.create({ data: { recruitmentId, applicationStatus, notes } }); }
    res.json(tracker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/applications/:recruitmentId', async (req, res) => {
  try {
    const recruitmentId = parseInt(req.params.recruitmentId);
    const data = req.body;
    let tracker = await prisma.applicationTracker.findUnique({ where: { recruitmentId } });
    if (tracker) { tracker = await prisma.applicationTracker.update({ where: { recruitmentId }, data }); }
    else { tracker = await prisma.applicationTracker.create({ data: { recruitmentId, ...data } }); }
    res.json(tracker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dashboard Summary ---
app.get('/api/dashboard', async (req, res) => {
  try {
    const profile = await prisma.profile.findFirst();
    const totalOpportunities = await prisma.recruitment.count();
    const openOpportunities = await prisma.recruitment.count({ where: { status: 'OPEN' } });
    const upcomingOpportunities = await prisma.recruitment.count({ where: { status: 'UPCOMING' } });
    const closingSoon = await prisma.recruitment.count({ where: { status: 'CLOSING_SOON' } });

    let allOpps = await prisma.recruitment.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        organization: true, eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true } } } } } },
        applicationTracker: true,
      }
    });

    const enriched = allOpps.map(opp => {
      const elig = checkEligibility(profile, opp.eligibilityRule);
      const priority = calculatePriority(opp, elig, profile);
      let readiness = 0;
      if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
      return { ...opp, computedEligibility: elig, computedPriority: priority, readiness };
    });
    enriched.sort((a, b) => b.computedPriority - a.computedPriority);

    const now = new Date();
    const deadlines = enriched
      .filter(o => o.applicationEndDate && new Date(o.applicationEndDate) > now)
      .sort((a, b) => new Date(a.applicationEndDate) - new Date(b.applicationEndDate))
      .slice(0, 5)
      .map(o => ({
        id: o.id, postName: o.postName, organizationName: o.organization?.name,
        applicationEndDate: o.applicationEndDate,
        daysLeft: Math.ceil((new Date(o.applicationEndDate) - now) / (1000 * 3600 * 24)),
      }));

    const allProgress = await prisma.topicProgress.findMany();
    const totalTopics = allProgress.length;
    const completedTopics = allProgress.filter(p => p.status === 'COMPLETED' || p.status === 'STRONG').length;
    const overallPreparation = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    res.json({ totalOpportunities, openOpportunities, upcomingOpportunities, closingSoon, highPriority: enriched.slice(0, 5), deadlines, overallPreparation });
  } catch (error) {
    console.error('[API] /api/dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Preparation & Syllabus ---
app.get('/api/syllabus', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            progress: true,
            examTopics: {
              include: {
                exam: {
                  include: {
                    recruitment: {
                      select: {
                        postName: true,
                        organization: { select: { name: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/preparation/topics/:id', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const data = req.body;
    let progress = await prisma.topicProgress.findUnique({ where: { topicId } });
    if (progress) { progress = await prisma.topicProgress.update({ where: { topicId }, data: { ...data, lastStudiedAt: new Date() } }); }
    else { progress = await prisma.topicProgress.create({ data: { ...data, topicId, lastStudiedAt: new Date() } }); }
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/preparation/daily-plan', async (req, res) => {
  try {
    const plan = await generateDailyPlan();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/preparation/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.dailyTask.update({ where: { id: parseInt(req.params.id) }, data: { isCompleted: req.body.isCompleted } });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Search ---
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ recruitments: [], organizations: [], subjects: [] });
    const s = q.toLowerCase();
    const recruitments = await prisma.recruitment.findMany({ include: { organization: true } });
    const filteredRecruitments = recruitments.filter(r => r.recruitmentName.toLowerCase().includes(s) || r.postName.toLowerCase().includes(s) || r.organization?.name.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
    const subjects = await prisma.subject.findMany({ include: { topics: true } });
    const filteredSubjects = subjects.filter(sub => sub.name.toLowerCase().includes(s) || sub.topics.some(t => t.name.toLowerCase().includes(s)));
    const organizations = await prisma.organization.findMany();
    const filteredOrgs = organizations.filter(o => o.name.toLowerCase().includes(s) || o.sector.toLowerCase().includes(s));
    res.json({ recruitments: filteredRecruitments.slice(0, 10), organizations: filteredOrgs.slice(0, 5), subjects: filteredSubjects.slice(0, 5) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Cron Trigger (for Vercel) ---
app.post('/api/cron/scrape', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const IBPSMockAdapter = require('./scrapers/ibpsMockAdapter');
    const ibps = new IBPSMockAdapter(prisma);
    await ibps.process();
    res.json({ status: 'ok', message: 'Scrapers executed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cron/deadline-check', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const closingSoon = await prisma.recruitment.findMany({
      where: { applicationEndDate: { gte: now, lte: threeDaysFromNow }, status: 'OPEN' }
    });
    const { notifyDeadline } = require('./services/notificationService');
    for (const opp of closingSoon) {
      const daysLeft = Math.ceil((opp.applicationEndDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      notifyDeadline(opp, daysLeft);
      await prisma.recruitment.update({ where: { id: opp.id }, data: { status: 'CLOSING_SOON' } });
    }
    res.json({ status: 'ok', updated: closingSoon.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// Start Server (only when NOT on Vercel)
// ==========================================
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    initCronJobs();
  });
}

module.exports = app;
