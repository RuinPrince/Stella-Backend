/**
 * Test deep scraper against ACTUAL job notification pages (not listing pages).
 * These are the pages that contain real job details.
 */
const UniversalAdapter = require('./src/scrapers/UniversalAdapter');
const mockPrisma = {};

async function testUrl(name, adapterName, orgName, sector, testUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${testUrl}`);
  console.log('='.repeat(60));
  
  try {
    const adapter = new UniversalAdapter(mockPrisma, adapterName, orgName, sector);
    const details = await adapter.scrapeDetailPage(testUrl);
    
    console.log('\n📋 EXTRACTED DETAILS:');
    console.log('─'.repeat(40));
    
    if (details.applicationStartDate) console.log(`  📅 App Start:     ${details.applicationStartDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    if (details.applicationEndDate) console.log(`  ⏰ App End:       ${details.applicationEndDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    if (details.examDate) console.log(`  📝 Exam Date:     ${details.examDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    if (details.notificationDate) console.log(`  📢 Notification:  ${details.notificationDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    if (details.basicPay) console.log(`  💰 Basic Pay:     ${details.basicPay}`);
    if (details.payScale) console.log(`  💰 Pay Scale:     ${details.payScale}`);
    if (details.payLevel) console.log(`  💰 Pay Level:     ${details.payLevel}`);
    if (details.grossSalary) console.log(`  💰 Gross Salary:  ${details.grossSalary}`);
    if (details.ctc) console.log(`  💰 CTC:           ${details.ctc}`);
    if (details.vacancies) console.log(`  👥 Vacancies:     ${details.vacancies}`);
    if (details.qualificationSummary) console.log(`  🎓 Qualification: ${details.qualificationSummary}`);
    if (details.eligibilityRule) {
      console.log(`  📋 Eligibility:`);
      if (details.eligibilityRule.allowedDegrees) console.log(`     Degrees:  ${details.eligibilityRule.allowedDegrees}`);
      if (details.eligibilityRule.allowedBranches) console.log(`     Branches: ${details.eligibilityRule.allowedBranches}`);
      if (details.eligibilityRule.minAge) console.log(`     Min Age:  ${details.eligibilityRule.minAge}`);
      if (details.eligibilityRule.maxAge) console.log(`     Max Age:  ${details.eligibilityRule.maxAge}`);
      if (details.eligibilityRule.minPercentage) console.log(`     Min %:    ${details.eligibilityRule.minPercentage}%`);
    }
    if (details.selectionProcess) console.log(`  🔄 Selection:     ${details.selectionProcess}`);
    if (details.examPattern) console.log(`  📝 Exam Pattern:  ${details.examPattern}`);
    if (details.description) console.log(`  📄 Description:   ${details.description.substring(0, 200)}...`);
    
    const fields = Object.keys(details).filter(k => details[k] != null);
    console.log(`\n  ✅ Populated ${fields.length} fields`);
    
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }
}

async function main() {
  console.log('🔬 DEEP SCRAPER TEST SUITE v2 — Real Notification Pages');

  // UPSC notification (HTML page with tables)
  await testUrl(
    'UPSC - Civil Services',
    'upscAdapter', 'UPSC', 'Government',
    'https://upsc.gov.in/examinations/civil-services-examination'
  );

  // RBI career opportunities (has proper HTML tables)
  await testUrl(
    'RBI Opportunities',
    'rbiAdapter', 'RBI', 'Banking',
    'https://opportunities.rbi.org.in/Scripts/Vacancies.aspx'
  );

  // Power Grid job opportunities page
  await testUrl(
    'Power Grid Jobs',
    'powerGridAdapter', 'Power Grid', 'PSU',
    'https://www.powergrid.in/job-opportunities'
  );

  // NIELIT recruitment page
  await testUrl(
    'NIELIT Recruitment',
    'nielitAdapter', 'NIELIT', 'Government',
    'https://nielit.gov.in/content/recruitment'
  );

  console.log('\n\n' + '='.repeat(60));
  console.log('Test suite complete.');
}

main().catch(console.error);
