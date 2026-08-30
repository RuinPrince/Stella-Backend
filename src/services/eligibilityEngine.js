function calculateAge(dob, now = new Date()) {
  if (!dob || Number.isNaN(new Date(dob).getTime())) return null;
  const birth = new Date(dob);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function list(value) { return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean); }

function checkEligibility(profile, rule, now = new Date()) {
  if (!rule) return { status: 'UNKNOWN', reasons: ['⚠️ Eligibility requirements are unavailable'], checks: [{ field: 'Requirements', status: 'UNKNOWN', message: 'No eligibility rule supplied' }] };
  if (!profile) return { status: 'UNKNOWN', reasons: ['⚠️ Profile is required to evaluate eligibility'], checks: [{ field: 'Profile', status: 'UNKNOWN', message: 'No profile supplied' }] };
  const checks = [];
  const add = (field, status, message) => checks.push({ field, status, message });
  let failed = false;
  let unknown = false;
  const pass = (field, message) => add(field, 'PASS', message);
  const fail = (field, message) => { failed = true; add(field, 'FAIL', message); };
  const missing = (field, message) => { unknown = true; add(field, 'UNKNOWN', message); };
  if (rule.minAge != null || rule.maxAge != null) {
    const age = calculateAge(profile.dateOfBirth, now);
    if (age == null) missing('Age', 'Date of birth is required');
    else if ((rule.minAge != null && age < rule.minAge) || (rule.maxAge != null && age > rule.maxAge)) fail('Age', `Age ${age} is outside the permitted range`);
    else pass('Age', `Age ${age} meets the requirement`);
  }
  if (rule.allowedDegrees) {
    if (!profile.education) missing('Degree', 'Education is required');
    else if (!list(rule.allowedDegrees).some((degree) => degree === 'any' || profile.education.toLowerCase().includes(degree))) fail('Degree', `${profile.education} is not an allowed degree`);
    else pass('Degree', `${profile.education} is allowed`);
  }
  if (rule.allowedBranches) {
    if (!profile.branch) missing('Branch', 'Branch is required');
    else if (!list(rule.allowedBranches).some((branch) => branch === 'any' || profile.branch.toLowerCase().includes(branch) || branch.includes(profile.branch.toLowerCase()))) fail('Branch', `${profile.branch} is not an allowed branch`);
    else pass('Branch', `${profile.branch} is allowed`);
  }
  if (rule.minPercentage != null) {
    if (profile.percentage == null) missing('Percentage', `A minimum of ${rule.minPercentage}% is required`);
    else if (Number(profile.percentage) < Number(rule.minPercentage)) fail('Percentage', `${profile.percentage}% is below ${rule.minPercentage}%`);
    else pass('Percentage', `${profile.percentage}% meets ${rule.minPercentage}%`);
  }
  if (rule.experienceYears != null && rule.experienceYears > 0) {
    if (profile.experienceYears == null) missing('Experience', `${rule.experienceYears} years of experience is required`);
    else if (profile.experienceYears < rule.experienceYears) fail('Experience', `${profile.experienceYears} years is below ${rule.experienceYears} years`);
    else pass('Experience', `${profile.experienceYears} years meets the requirement`);
  }
  if (rule.qualificationCutoffDate) {
    if (!profile.graduationYear) missing('Graduation', 'Graduation date is required');
    else {
      const graduation = new Date(profile.graduationYear, (profile.graduationMonth || 6) - 1, 15);
      const cutoff = new Date(rule.qualificationCutoffDate);
      if (graduation > cutoff && !rule.allowsFinalYear) fail('Graduation', 'Graduation date is after the qualification cutoff');
      else if (graduation > cutoff) pass('Graduation', 'Final-year candidates are explicitly allowed');
      else pass('Graduation', 'Graduation date meets the cutoff');
    }
  }
  if (rule.otherRequirements) missing('Other requirements', 'Manual verification is required for additional stated requirements');
  const status = failed ? 'NOT_ELIGIBLE' : unknown ? 'UNKNOWN' : 'ELIGIBLE';
  const icons = { PASS: '✅', FAIL: '❌', UNKNOWN: '⚠️' };
  return { status, checks, reasons: checks.map((check) => `${icons[check.status]} ${check.field}: ${check.message}`) };
}
module.exports = { calculateAge, checkEligibility };
