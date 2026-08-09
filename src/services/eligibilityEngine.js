function calculateAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const age = new Date(diff); 
  return Math.abs(age.getUTCFullYear() - 1970);
}

function checkEligibility(profile, rule) {
  if (!rule) return "NEEDS_VERIFICATION";
  if (!profile) return "NEEDS_VERIFICATION";

  let isEligible = true;
  let hasWarnings = false;

  // 1. Check Age
  if (profile.dateOfBirth) {
    const age = calculateAge(profile.dateOfBirth);
    if (rule.maxAge && age > rule.maxAge) return "NOT_ELIGIBLE";
    if (rule.minAge && age < rule.minAge) return "NOT_ELIGIBLE";
  } else if (rule.maxAge || rule.minAge) {
    hasWarnings = true;
  }

  // 2. Check Degree
  if (rule.allowedDegrees && profile.education) {
    const allowed = rule.allowedDegrees.toLowerCase().split(',').map(s => s.trim());
    const userEd = profile.education.toLowerCase();
    if (!allowed.some(d => userEd.includes(d))) {
      return "NOT_ELIGIBLE";
    }
  } else if (rule.allowedDegrees && !profile.education) {
    hasWarnings = true;
  }

  if (hasWarnings) return "PROBABLY_ELIGIBLE";
  return "ELIGIBLE";
}

module.exports = { checkEligibility };
