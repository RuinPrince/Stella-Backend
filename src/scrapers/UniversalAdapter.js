const axios = require('axios');
const cheerio = require('cheerio');
const BaseAdapter = require('./baseAdapter');
const scraperConfig = require('./scraperConfig.json');

class UniversalAdapter extends BaseAdapter {
  constructor(prisma, adapterName, orgName, sector) {
    super(prisma, orgName, sector);
    this.adapterName = adapterName;
    this.config = scraperConfig[adapterName];
    if (!this.config) {
      throw new Error(`Configuration for ${adapterName} not found in scraperConfig.json`);
    }
  }

  async fetchOpportunities() {
    console.log(`[UniversalAdapter] Attempting to scrape ${this.orgName}...`);
    const jobs = [];
    
    try {
      // Simulate real browser headers
      const response = await axios.get(this.config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000 // 15 seconds
      });

      const $ = cheerio.load(response.data);
      
      // 1. Try Primary Selectors
      let foundViaSelector = false;
      if (this.config.listSelector) {
        $(this.config.listSelector).each((i, el) => {
          const title = $(el).find(this.config.titleSelector).text().trim() || $(el).text().trim();
          let link = $(el).find(this.config.linkSelector).attr('href');
          
          if (title && title.length > 5 && link) {
            // resolve relative links
            if (link.startsWith('/')) {
              try {
                const baseUrl = new URL(this.config.url);
                link = `${baseUrl.origin}${link}`;
              } catch(e) {}
            }
            
            jobs.push({
              title: title.substring(0, 100),
              url: link,
              fallback: false
            });
            foundViaSelector = true;
          }
        });
      }

      // 2. Heuristic Fallback (if primary fails)
      if (!foundViaSelector && this.config.fallbackKeywords) {
        console.log(`[UniversalAdapter] Primary selectors failed for ${this.orgName}, falling back to heuristic keyword scanning...`);
        
        $('a').each((i, el) => {
          const text = $(el).text().trim().toLowerCase();
          const href = $(el).attr('href');
          
          if (text && href) {
            // Check if text matches any fallback keyword
            const isMatch = this.config.fallbackKeywords.some(kw => text.includes(kw));
            if (isMatch && text.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
              let link = href;
              if (link.startsWith('/')) {
                try {
                  const baseUrl = new URL(this.config.url);
                  link = `${baseUrl.origin}${link}`;
                } catch(e) {}
              }
              
              // avoid exact duplicates
              if (!jobs.find(j => j.url === link)) {
                jobs.push({
                  title: text.substring(0, 100),
                  url: link,
                  fallback: true
                });
              }
            }
          }
        });
      }

      // 3. Process the extracted jobs
      const formattedJobs = jobs.slice(0, 5).map(j => ({ // limit to top 5 to avoid spam
        recruitmentName: `${this.organizationName} Recruitment 2026`,
        postName: this.capitalize(j.title),
        status: 'OPEN',
        applicationEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Guess: 15 days from now
        basicPay: 'Not specified',
        description: `Source: ${j.url}`,
        officialApplicationUrl: j.url
      }));

      return formattedJobs;

    } catch (error) {
      console.log(`[UniversalAdapter] Fetch error for ${this.orgName}: ${error.message}`);
      throw error;
    }
  }

  capitalize(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }
}

module.exports = UniversalAdapter;
