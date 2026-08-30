const test = require('node:test');
const assert = require('node:assert/strict');
const { createOpportunityLifecycle } = require('../src/services/opportunityLifecycle');
test('lifecycle transitions opportunities safely', async () => {
  const updates = []; const now = new Date('2026-08-15T00:00:00Z');
  const db = { recruitment: { findMany: async ({ where }) => { if (where.applicationEndDate?.lt) return [{ id: 1 }]; if (where.applicationEndDate?.lte) return [{ id: 2, applicationEndDate: new Date('2026-08-16') }]; if (where.status === 'NEW') return [{ id: 3 }]; if (where.applicationStartDate) return [{ id: 4 }]; return []; }, update: async (update) => updates.push(update) } };
  const result = await createOpportunityLifecycle(db, async () => {})(now);
  assert.deepEqual(result, { expired: 1, closingSoon: 1, verified: 1, activated: 1 });
  assert.deepEqual(updates.map((update) => update.data.status), ['EXPIRED', 'DEADLINE_SOON', 'VERIFIED', 'ACTIVE']);
});
