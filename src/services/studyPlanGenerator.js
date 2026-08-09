const prisma = require('../lib/prisma');

async function generateDailyPlan() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let tasks = await prisma.dailyTask.findMany({
    where: { date: { gte: today } },
    include: { topic: { include: { subject: true } } }
  });

  if (tasks.length > 0) {
    return tasks;
  }

  console.log('[StudyPlanGenerator] Generating new daily plan...');

  const weakTopics = await prisma.topicProgress.findMany({
    where: { status: { in: ['NEEDS_REVISION', 'LEARNING'] } },
    include: { topic: { include: { subject: true } } },
    take: 2
  });

  const newTopics = await prisma.topicProgress.findMany({
    where: { status: 'NOT_STARTED' },
    include: { topic: { include: { subject: true } } },
    take: 1
  });

  const generatedTasks = [];

  for (const p of weakTopics) {
    generatedTasks.push({
      date: today,
      type: p.status === 'NEEDS_REVISION' ? 'REVISE' : 'LEARNING',
      title: `${p.topic.subject.name} - ${p.topic.name}`,
      topicId: p.topicId,
      isCompleted: false
    });
  }

  for (const p of newTopics) {
    generatedTasks.push({
      date: today,
      type: 'LEARN',
      title: `${p.topic.subject.name} - ${p.topic.name}`,
      topicId: p.topicId,
      isCompleted: false
    });
  }

  generatedTasks.push({
    date: today,
    type: 'PRACTICE',
    title: 'Solve 20 Technical PYQs',
    isCompleted: false
  });

  await prisma.dailyTask.createMany({ data: generatedTasks });

  tasks = await prisma.dailyTask.findMany({
    where: { date: { gte: today } },
    include: { topic: { include: { subject: true } } }
  });

  return tasks;
}

module.exports = { generateDailyPlan };
