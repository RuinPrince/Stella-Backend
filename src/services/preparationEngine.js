function calculateReadiness(examTopics) {
  if (!examTopics || examTopics.length === 0) return 0;
  
  let totalScore = 0;
  let maxPossibleScore = examTopics.length * 100;

  for (const et of examTopics) {
    const progress = et.topic?.progress;
    if (!progress) continue;
    
    let score = 0;
    switch (progress.status) {
      case 'STRONG': score = 100; break;
      case 'COMPLETED': score = 80; break;
      case 'NEEDS_REVISION': score = 50; break;
      case 'LEARNING': score = 25; break;
      default: score = 0;
    }
    
    totalScore += score;
  }
  
  return Math.round((totalScore / maxPossibleScore) * 100);
}

module.exports = { calculateReadiness };
