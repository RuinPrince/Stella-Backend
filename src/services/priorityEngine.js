function calculatePriorityDetails(recruitment, eligibility, profile, now = new Date()) {
  const status = typeof eligibility === 'string' ? eligibility : eligibility?.status || 'UNKNOWN';
  if (status === 'NOT_ELIGIBLE') return { score: 0, reasons: ['Not eligible'] };
  let score = status === 'ELIGIBLE' ? 35 : 10;
  const reasons = [status === 'ELIGIBLE' ? 'Eligibility confirmed' : 'Eligibility needs verification'];
  const days = recruitment.applicationEndDate ? Math.ceil((new Date(recruitment.applicationEndDate) - now) / 86400000) : null;
  if (days != null && days < 0) return { score: 0, reasons: ['Application deadline has passed'] };
  if (days != null && days <= 3) { score += 25; reasons.push('Deadline is within 3 days'); }
  else if (days != null && days <= 14) { score += 15; reasons.push('Deadline is within 14 days'); }
  if (recruitment.verificationStatus === 'VERIFIED_FROM_OFFICIAL_SOURCE') { score += 5; reasons.push('Officially verified'); }
  const text = `${recruitment.postName || ''} ${recruitment.description || ''}`.toLowerCase();
  const skills = String(profile?.skills || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const matchingSkills = skills.filter((skill) => text.includes(skill));
  if (skills.length) { score += Math.round(15 * matchingSkills.length / skills.length); if (matchingSkills.length) reasons.push(`Skills match: ${matchingSkills.join(', ')}`); }
  const roles = String(profile?.preferredRoles || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (roles.some((role) => String(recruitment.postName || '').toLowerCase().includes(role))) { score += 10; reasons.push('Preferred role match'); }
  if (profile?.salaryPreference && recruitment.basicPay) {
    const desired = Number(String(profile.salaryPreference).replace(/\D/g, ''));
    const pay = Number(String(recruitment.basicPay).replace(/\D/g, ''));
    if (desired && pay >= desired) { score += 10; reasons.push('Salary preference met'); }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}
function calculatePriority(recruitment, eligibility, profile, now) { return calculatePriorityDetails(recruitment, eligibility, profile, now).score; }
module.exports = { calculatePriority, calculatePriorityDetails };
