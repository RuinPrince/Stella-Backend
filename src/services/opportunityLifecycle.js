const prisma = require('../lib/prisma');
const { notifyDeadline } = require('./notificationService');

function createOpportunityLifecycle(db, notify = notifyDeadline) {
  return async function processOpportunityLifecycle(now = new Date()) {
    const expired = await db.recruitment.findMany({ where: { applicationEndDate: { lt: now }, status: { notIn: ['CLOSED', 'EXPIRED'] } } });
    for (const opportunity of expired) await db.recruitment.update({ where: { id: opportunity.id }, data: { status: 'EXPIRED' } });
    const closingDate = new Date(now.getTime() + 3 * 86400000);
    const closingSoon = await db.recruitment.findMany({ where: { applicationEndDate: { gte: now, lte: closingDate }, status: { notIn: ['CLOSED', 'EXPIRED', 'DEADLINE_SOON'] } } });
    for (const opportunity of closingSoon) { await db.recruitment.update({ where: { id: opportunity.id }, data: { status: 'DEADLINE_SOON' } }); await notify(opportunity, Math.ceil((opportunity.applicationEndDate - now) / 86400000)); }
    const verified = await db.recruitment.findMany({ where: { status: 'NEW', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE' } });
    for (const opportunity of verified) await db.recruitment.update({ where: { id: opportunity.id }, data: { status: 'VERIFIED' } });
    const active = await db.recruitment.findMany({ where: { applicationStartDate: { lte: now }, applicationEndDate: { gt: now }, status: { in: ['UPCOMING', 'VERIFIED', 'OPEN', 'CLOSING_SOON'] } } });
    for (const opportunity of active) await db.recruitment.update({ where: { id: opportunity.id }, data: { status: 'ACTIVE' } });
    return { expired: expired.length, closingSoon: closingSoon.length, verified: verified.length, activated: active.length };
  };
}
const processOpportunityLifecycle = createOpportunityLifecycle(prisma);
module.exports = { createOpportunityLifecycle, processOpportunityLifecycle };
