const BaseAdapter = require('./baseAdapter');
const axios = require('axios');
const { JSDOM } = require('jsdom');

class LeverAdapter extends BaseAdapter {
  constructor(prisma, adapterName, organizationName, sector, boardToken) {
    super(prisma, organizationName, sector);
    this.boardToken = boardToken; // e.g., 'freshworks'
  }

  async fetchOpportunities() {
    try {
      const url = `https://api.lever.co/v0/postings/${this.boardToken}?mode=json`;
      console.log(`[LeverAdapter] Fetching from ${url}`);
      const response = await axios.get(url);
      const jobs = response.data;
      
      const opportunities = [];

      for (const job of jobs) {
        // Lever provides description in HTML, we need to extract text
        let descriptionText = '';
        if (job.description) {
          const dom = new JSDOM(job.description);
          descriptionText = dom.window.document.body.textContent || '';
        }
        
        let jobType = 'Full-time';
        if (job.categories?.commitment) {
          if (job.categories.commitment.toLowerCase().includes('intern')) jobType = 'Internship';
          else if (job.categories.commitment.toLowerCase().includes('contract')) jobType = 'Contract';
        }

        // Determine if there are specific degrees/branches mentioned
        let allowedDegrees = null;
        let allowedBranches = null;
        const lowerDesc = descriptionText.toLowerCase();
        
        if (lowerDesc.includes('b.tech') || lowerDesc.includes('btech') || lowerDesc.includes('b.e') || lowerDesc.includes('bachelor of engineering')) {
          allowedDegrees = 'B.Tech, B.E';
        }
        if (lowerDesc.includes('computer science') || lowerDesc.includes('information technology')) {
          allowedBranches = 'CSE, IT';
        }
        
        const opportunity = {
          recruitmentName: `${this.organizationName} Recruitment ${new Date().getFullYear()}`,
          postName: job.text,
          description: descriptionText.substring(0, 5000), // Trim to fit schema constraints if any
          jobType: jobType,
          sector: this.sector,
          officialNotificationUrl: job.hostedUrl,
          officialApplicationUrl: job.applyUrl,
          sourceUrl: job.hostedUrl,
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

      console.log(`[LeverAdapter] Found ${opportunities.length} opportunities for ${this.organizationName}`);
      return opportunities;

    } catch (error) {
      console.error(`[LeverAdapter] Error fetching Lever API for ${this.organizationName}:`, error.message);
      return [];
    }
  }
}

module.exports = LeverAdapter;
