function calculatePriority(recruitment, eligibilityStatus, profile) {
  let score = 0;

  // 1. Eligibility Score
  if (eligibilityStatus === "ELIGIBLE") score += 50;
  if (eligibilityStatus === "PROBABLY_ELIGIBLE") score += 20;
  if (eligibilityStatus === "NOT_ELIGIBLE") return 0; // No priority if not eligible

  // 2. Deadline Score
  if (recruitment.applicationEndDate) {
    const daysLeft = (new Date(recruitment.applicationEndDate).getTime() - Date.now()) / (1000 * 3600 * 24);
    if (daysLeft > 0 && daysLeft <= 14) score += 30;
    else if (daysLeft > 14 && daysLeft <= 30) score += 15;
    else if (daysLeft < 0) score -= 100; // Passed
  }

  // 3. Salary Preference Match (Very basic check)
  if (profile?.salaryPreference && recruitment.basicPay) {
    // A complex app would parse numeric values, but for now we'll just bump score if both exist
    score += 10;
  }

  return score;
}

module.exports = { calculatePriority };
