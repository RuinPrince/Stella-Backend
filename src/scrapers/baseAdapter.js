const { notifyNewOpportunity, notifyImportantUpdate } = require('../services/notificationService');

class BaseAdapter {
  constructor(prisma, organizationName, sector) {
    this.prisma = prisma;
    this.organizationName = organizationName;
    this.sector = sector;
  }

  async getOrganization() {
    let org = await this.prisma.organization.findFirst({
      where: { name: this.organizationName }
    });
    if (!org) {
      org = await this.prisma.organization.create({
        data: { name: this.organizationName, sector: this.sector }
      });
    }
    return org;
  }

  // To be implemented by subclasses
  async fetchOpportunities() {
    throw new Error('fetchOpportunities() must be implemented');
  }

  async process() {
    console.log(`[BaseAdapter] Starting scraping for ${this.organizationName}...`);
    const org = await this.getOrganization();
      const rawOpportunities = await this.fetchOpportunities();

      for (const raw of rawOpportunities) {
        // Separate nested relations from flat data
        const { eligibilityRule, exam, ...flatData } = raw;

        // Fuzzy Deduplication
        const allOrgRecruitments = await this.prisma.recruitment.findMany({
          where: { organizationId: org.id, status: { not: 'CLOSED' } },
          include: { organization: true }
        });

        const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const targetPost = normalize(flatData.postName);
        
        let existing = allOrgRecruitments.find(r => 
          normalize(r.recruitmentName) === normalize(flatData.recruitmentName) &&
          normalize(r.postName) === targetPost
        );

        // Even fuzzier: if postName is very similar and it's from the same organization recently
        if (!existing) {
          existing = allOrgRecruitments.find(r => 
            normalize(r.postName).includes(targetPost) || targetPost.includes(normalize(r.postName))
          );
        }

        if (!existing) {
          // New Recruitment
          const createData = {
            organizationId: org.id,
            ...flatData,
          };

          // Attach nested relations if provided
          if (eligibilityRule) {
            createData.eligibilityRule = { create: eligibilityRule };
          }
          if (exam) {
            createData.exam = { create: exam };
          }

          const newRecruitment = await this.prisma.recruitment.create({
            data: createData,
            include: { organization: true }
          });
          notifyNewOpportunity(newRecruitment);
        } else {
          // Change Detection
          let changes = [];
          if (flatData.vacancies && existing.vacancies !== flatData.vacancies) {
            changes.push(`Vacancies updated from ${existing.vacancies} to ${flatData.vacancies}`);
          }
          if (flatData.applicationEndDate && existing.applicationEndDate?.getTime() !== flatData.applicationEndDate.getTime()) {
            const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const dateStr = flatData.applicationEndDate.toLocaleString('en-IN', options) + ' IST';
            changes.push(`Deadline updated to ${dateStr}`);
          }

          if (changes.length > 0) {
            await this.prisma.recruitment.update({
              where: { id: existing.id },
              data: flatData
            });
            notifyImportantUpdate(existing, changes.join(', '));
          }
        }
      }
  }
}

module.exports = BaseAdapter;
