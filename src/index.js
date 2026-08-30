const express = require('express');
const cors = require('cors');
require('dotenv').config();

const prisma = require('./lib/prisma');

const { checkEligibility } = require('./services/eligibilityEngine');
const { calculatePriority } = require('./services/priorityEngine');
const { calculateReadiness } = require('./services/preparationEngine');
const { generateDailyPlan } = require('./services/studyPlanGenerator');


const sourcesRoutes = require('./routes/sources');
const { initCronJobs } = require('./cron');

const app = express();
app.use(cors());
app.use(express.json());

const requestBuckets = new Map();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt > 60_000) { bucket.startedAt = now; bucket.count = 0; }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  if (bucket.count > 120) return res.status(429).json({ error: 'Too many requests' });
  next();
});

// ==========================================
// Authentication Middleware
// ==========================================
async function requireUser(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'stella-dev-api-key-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { uid: 'dev-user-1' };
  next();
}

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/cron/')) return next();
  return requireUser(req, res, next);
});

const profileFields = new Set(['education', 'branch', 'graduationYear', 'graduationMonth', 'dateOfBirth', 'country', 'state', 'primaryInterests', 'salaryPreference', 'fcmToken', 'skills', 'cgpa', 'percentage', 'experienceYears', 'programmingLanguages', 'preferredRoles', 'workMode']);
const pick = (body, allowed) => Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.has(key)));
const applicationStages = new Set(['SAVED', 'PLANNING', 'APPLIED', 'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED', 'INTERVIEW_SCHEDULED', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN']);
const attachTracker = (opportunity) => {
  const { applicationTrackers = [], ...rest } = opportunity;
  return { ...rest, applicationTracker: applicationTrackers[0] || null };
};

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
    let profile = await prisma.profile.findUnique({ where: { userId: req.user.uid } });
    if (!profile) {
      profile = await prisma.profile.create({ data: { userId: req.user.uid } });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const data = pick(req.body, profileFields);
    let profile = await prisma.profile.findUnique({ where: { userId: req.user.uid } });
    if (profile) {
      profile = await prisma.profile.update({ where: { id: profile.id }, data });
    } else {
      profile = await prisma.profile.create({ data: { ...data, userId: req.user.uid } });
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
    const { name, sector, officialUrl } = req.body;
    if (!name || !sector) return res.status(400).json({ error: 'name and sector are required' });
    const org = await prisma.organization.create({ data: { name, sector, officialUrl: officialUrl || null } });
    res.json(org);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Recruitments / Opportunities ---
app.get('/api/opportunities', async (req, res) => {
  try {
    const { sector, eligibility, minSalary, status: statusFilter, search, sort, jobType } = req.query;

    const profile = await prisma.profile.findUnique({ where: { userId: req.user.uid } });
    let opportunities = await prisma.recruitment.findMany({
      include: {
        organization: true,
        eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true, subject: true } } } } } },
        applicationTrackers: { where: { userId: req.user.uid }, take: 1 },
      }
    });

    opportunities = opportunities.map(opp => {
      opp = attachTracker(opp);
      const computedElig = checkEligibility(profile, opp.eligibilityRule);
      const priority = calculatePriority(opp, computedElig.status, profile);
      let readiness = 0;
      if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
      return { 
        ...opp, 
        computedEligibility: computedElig.status, 
        eligibilityReasons: computedElig.reasons,
        computedPriority: priority, 
        readiness 
      };
    });

    if (search) {
      const s = search.toLowerCase();
      opportunities = opportunities.filter(o =>
        o.recruitmentName.toLowerCase().includes(s) || o.postName.toLowerCase().includes(s) ||
        o.organization?.name.toLowerCase().includes(s) || (o.description || '').toLowerCase().includes(s)
      );
    }
    if (sector) { opportunities = opportunities.filter(o => (o.sector || o.organization?.sector || '').toLowerCase() === sector.toLowerCase()); }
    if (jobType) { opportunities = opportunities.filter(o => (o.jobType || '').toLowerCase() === jobType.toLowerCase()); }
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
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.uid } });
    let opp = await prisma.recruitment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        organization: true, eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true, subject: true } } } } } },
        applicationTrackers: { where: { userId: req.user.uid }, take: 1 },
      }
    });
    if (!opp) return res.status(404).json({ error: "Not found" });
    opp = attachTracker(opp);
    const elig = checkEligibility(profile, opp.eligibilityRule);
    const priority = calculatePriority(opp, elig.status, profile);
    let readiness = 0;
    if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
    res.json({ 
      ...opp, 
      computedEligibility: elig.status, 
      eligibilityReasons: elig.reasons,
      computedPriority: priority, 
      readiness 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/opportunities', async (req, res) => {
  try {
    res.status(403).json({ error: 'Direct opportunity creation is disabled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/opportunities/:id', async (req, res) => {
  try {
    res.status(403).json({ error: 'Direct opportunity modification is disabled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Application Tracker ---
app.get('/api/applications', async (req, res) => {
  try {
    const apps = await prisma.applicationTracker.findMany({ where: { userId: req.user.uid }, include: { recruitment: { include: { organization: true } } } });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { recruitmentId } = req.body;
    if (!Number.isInteger(recruitmentId)) return res.status(400).json({ error: 'recruitmentId must be an integer' });
    const data = pick(req.body, new Set(['applicationStatus', 'notes', 'applicationDate', 'followUpDate', 'applicationUrl']));
    if (data.applicationStatus && !applicationStages.has(data.applicationStatus)) return res.status(400).json({ error: 'Invalid application status' });
    let tracker = await prisma.applicationTracker.findUnique({ where: { userId_recruitmentId: { userId: req.user.uid, recruitmentId } } });
    if (tracker) { tracker = await prisma.applicationTracker.update({ where: { id: tracker.id }, data }); }
    else { tracker = await prisma.applicationTracker.create({ data: { recruitmentId, userId: req.user.uid, ...data, stageHistory: [] } }); }
    res.json(tracker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/applications/:recruitmentId', async (req, res) => {
  try {
    const recruitmentId = parseInt(req.params.recruitmentId);
    const data = pick(req.body, new Set(['applicationStatus', 'notes', 'applicationDate', 'followUpDate', 'applicationUrl']));
    if (data.applicationStatus && !applicationStages.has(data.applicationStatus)) return res.status(400).json({ error: 'Invalid application status' });
    const stage = data.applicationStatus;
    let tracker = await prisma.applicationTracker.findUnique({ where: { userId_recruitmentId: { userId: req.user.uid, recruitmentId } } });
    if (tracker) {
      const stageHistory = stage && stage !== tracker.applicationStatus ? [...(tracker.stageHistory || []), { stage, at: new Date().toISOString(), note: data.notes || null }] : tracker.stageHistory;
      tracker = await prisma.applicationTracker.update({ where: { id: tracker.id }, data: { ...data, stageHistory } });
    } else { tracker = await prisma.applicationTracker.create({ data: { recruitmentId, userId: req.user.uid, ...data, stageHistory: stage ? [{ stage, at: new Date().toISOString(), note: data.notes || null }] : [] } }); }
    res.json(tracker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dashboard Summary ---
app.get('/api/dashboard', async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.uid } });
    const totalOpportunities = await prisma.recruitment.count();
    const openOpportunities = await prisma.recruitment.count({ where: { status: 'ACTIVE' } });
    const upcomingOpportunities = await prisma.recruitment.count({ where: { status: 'UPCOMING' } });
    const closingSoon = await prisma.recruitment.count({ where: { status: 'DEADLINE_SOON' } });

    let allOpps = await prisma.recruitment.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        organization: true, eligibilityRule: true,
        exam: { include: { examTopics: { include: { topic: { include: { progress: true } } } } } },
        applicationTrackers: { where: { userId: req.user.uid }, take: 1 },
      }
    });

    const enriched = allOpps.map(opp => {
      opp = attachTracker(opp);
      const elig = checkEligibility(profile, opp.eligibilityRule);
      const priority = calculatePriority(opp, elig.status, profile);
      let readiness = 0;
      if (opp.exam?.examTopics) { readiness = calculateReadiness(opp.exam.examTopics); }
      return { ...opp, computedEligibility: elig.status, eligibilityReasons: elig.reasons, computedPriority: priority, readiness };
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
    const allowedFields = new Set(['status', 'studyHours', 'questionsSolved', 'accuracy']);
    const data = pick(req.body, allowedFields);
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
    const sources = await prisma.scraperSource.findMany({
      where: { status: { not: 'UNAVAILABLE' } },
      orderBy: { lastCheckedAt: 'asc' },
      take: 10
    });

    const UniversalAdapter = require('./scrapers/UniversalAdapter');
    const fs = require('fs');
    const path = require('path');

    let processed = [];

    for (const src of sources) {
      await prisma.scraperSource.update({ where: { id: src.id }, data: { lastCheckedAt: new Date() } });
      try {
        const adapterPath = path.join(__dirname, `scrapers/${src.adapterName}.js`);
        let adapterInstance;
        if (fs.existsSync(adapterPath)) {
          const AdapterClass = require(adapterPath);
          adapterInstance = new AdapterClass(prisma);
        } else {
          if (src.category === 'PRIVATE_IT') {
            await prisma.scraperSource.update({ where: { id: src.id }, data: { status: 'UNAVAILABLE' } });
            processed.push({ name: src.name, status: 'unavailable', reason: 'No supported official ATS adapter' });
            continue;
          }
          adapterInstance = new UniversalAdapter(prisma, src.adapterName, src.name, src.category);
        }
        await adapterInstance.process();
        await prisma.scraperSource.update({ where: { id: src.id }, data: { lastSuccessfulFetchAt: new Date(), status: 'ACTIVE' } });
        processed.push({ name: src.name, status: 'success' });
      } catch (err) {
        await prisma.scraperSource.update({ where: { id: src.id }, data: { status: 'NEEDS_ATTENTION' } });
        processed.push({ name: src.name, status: 'error', error: err.message });
      }
    }
    res.json({ status: 'ok', message: 'Cron processed batch of sources', processed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cron/deadline-check', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { processOpportunityLifecycle } = require('./services/opportunityLifecycle');
    const result = await processOpportunityLifecycle();
    res.json({ status: 'ok', ...result });
  } catch (e) {
    console.error('[API] /api/cron/deadline-check error:', e);
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
