const BaseAdapter = require('./baseAdapter');

class IBPSMockAdapter extends BaseAdapter {
  constructor(prisma) {
    super(prisma, 'IBPS', 'Banking');
  }

  async fetchOpportunities() {
    console.log('[IBPSMockAdapter] Simulating scraping from ibps.in...');

    // In a real adapter, we would use axios + cheerio to parse HTML
    // const response = await axios.get('https://www.ibps.in/');
    // const $ = cheerio.load(response.data);

    return [
      {
        recruitmentName: 'CRP SPL-XIV',
        postName: 'IT Officer (Scale-I)',
        vacancies: 120,
        description: 'Recruitment of IT Officers in participating banks.',
        basicPay: '₹36,000',
        sector: 'Banking',
        jobType: 'Specialist Officer',
        applicationStartDate: new Date('2026-08-01'),
        applicationEndDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        examDate: new Date('2026-11-25'),
        status: 'OPEN',
        verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE',
        officialNotificationUrl: 'https://ibps.in/crp-spl-xiv/',
        officialApplicationUrl: 'https://ibpsonline.ibps.in/crpspl14/',
        // Nested relations separated for BaseAdapter
        eligibilityRule: {
          allowedDegrees: 'B.Tech, B.E., MCA',
          allowedBranches: 'Information Technology, Computer Science, Electronics, Computer Applications',
          maxAge: 30,
          minAge: 20
        }
      }
    ];
  }
}

module.exports = IBPSMockAdapter;
