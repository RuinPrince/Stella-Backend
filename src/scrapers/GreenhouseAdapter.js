const BaseAdapter = require('./baseAdapter');
const axios = require('axios');
const { JSDOM } = require('jsdom');

class GreenhouseAdapter extends BaseAdapter {
  constructor(prisma, adapterName, organizationName, sector, boardToken) {
    super(prisma, organizationName, sector);
    this.boardToken = boardToken; // e.g., 'zoho'
  }

  async fetchOpportunities() {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${this.boardToken}/jobs?content=true`;
      console.log(`[GreenhouseAdapter] Fetching from ${url}`);
      const response = await axios.get(url);
      const jobs = response.data.jobs;
      
      const opportunities = [];

      for (const job of jobs) {
        let descriptionText = '';
        if (job.content) {
          const dom = new JSDOM(job.content);
          descriptionText = dom.window.document.body.textContent || '';
        }

        let jobType = 'Full-time';
        const titleLower = job.title.toLowerCase();
        if (titleLower.includes('intern') || titleLower.includes('internship')) jobType = 'Internship';
        else if (titleLower.includes('contract')) jobType = 'Contract';

        let allowedDegrees = null;
        let allowedBranches = null;
        const lowerDesc = descriptionText.toLowerCase();
        
        if (lowerDesc.includes('b.tech') || lowerDesc.includes('btech') || lowerDesc.includes('b.e') || lowerDesc.includes('bachelor of engineering')) {
          allowedDegrees = 'B.Tech, B.E';
        }
        if (lowerDesc.includes('computer science') || lowerDesc.includes('information technology')) {
          allowedBranches = 'CSE, IT';
        }

        let locationStr = 'India';
        if (job.location && job.location.name) {
          locationStr = job.location.name;
        }

        // Only add if location is roughly India (or we can add all if it's an Indian company)
        if (!locationStr.toLowerCase().includes('india') && !locationStr.toLowerCase().includes('remote') && !locationStr.toLowerCase().includes('chennai') && !locationStr.toLowerCase().includes('bangalore')) {
          // You might skip non-India jobs depending on requirements, but let's include them for now.
        }

        const opportunity = {
          recruitmentName: `${this.organizationName} Recruitment ${new Date().getFullYear()}`,
          postName: job.title,
          description: descriptionText.substring(0, 5000),
          jobType: jobType,
          sector: this.sector,
          officialNotificationUrl: job.absolute_url,
          officialApplicationUrl: job.absolute_url,
          sourceUrl: url,
          status: 'NEW',
          verificationStatus: 'NEEDS_VERIFICATION',
        };

        if (allowedDegrees || allowedBranches) {
          opportunity.eligibilityRule = {
            allowedDegrees,
            allowedBranches
          };
        }

        opportunities.push(opportunity);
      }

      console.log(`[GreenhouseAdapter] Found ${opportunities.length} opportunities for ${this.organizationName}`);
      return opportunities;

    } catch (error) {
      console.error(`[GreenhouseAdapter] Error fetching Greenhouse API for ${this.organizationName}:`, error.message);
      return [];
    }
  }
}

module.exports = GreenhouseAdapter;
