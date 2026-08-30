const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const BaseAdapter = require('./baseAdapter');
const scraperConfig = require('./scraperConfig.json');

// Some government sites have bad/mismatched SSL certs
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('[UniversalAdapter] pdf-parse not available, PDF scraping disabled.');
}

class UniversalAdapter extends BaseAdapter {
  constructor(prisma, adapterName, organizationName, sector) {
    super(prisma, organizationName, sector);
    this.adapterName = adapterName;
    this.config = scraperConfig[adapterName];
    if (!this.config) {
      throw new Error(`Configuration for ${adapterName} not found in scraperConfig.json`);
    }
  }

  async fetchOpportunities() {
    console.log(`[UniversalAdapter] Attempting to scrape ${this.organizationName}...`);
    const jobs = [];
    
    try {
      const response = await axios.get(this.config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000,
        httpsAgent,
      });

      const $ = cheerio.load(response.data);
      
      // 1. Try Structured Data (JSON-LD)
      let foundViaJsonLd = false;
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonStr = $(el).html();
          const parsed = JSON.parse(jsonStr);
          const processJsonLd = (obj) => {
            if (obj && obj['@type'] === 'JobPosting') {
              const title = obj.title;
              let link = obj.url || this.config.url;
              if (title) {
                jobs.push({ 
                  title: title.substring(0, 200), 
                  url: this.resolveUrl(link), 
                  fallback: false,
                  jsonLdData: obj
                });
                foundViaJsonLd = true;
              }
            } else if (Array.isArray(obj)) {
              obj.forEach(processJsonLd);
            } else if (obj && typeof obj === 'object') {
              if (obj['@graph']) {
                obj['@graph'].forEach(processJsonLd);
              }
            }
          };
          processJsonLd(parsed);
        } catch (e) {
          // Ignore JSON parse errors in script tags
        }
      });
      
      // 2. Try Primary Selectors if JSON-LD didn't yield results
      let foundViaSelector = false;
      if (!foundViaJsonLd && this.config.listSelector) {
        $(this.config.listSelector).each((i, el) => {
          const title = $(el).find(this.config.titleSelector).text().trim() || $(el).text().trim();
          let link = $(el).find(this.config.linkSelector).attr('href');
          
          if (title && title.length > 5 && link) {
            link = this.resolveUrl(link);
            jobs.push({ title: title.substring(0, 200), url: link, fallback: false });
            foundViaSelector = true;
          }
        });
      }

      // 2. Heuristic Fallback
      if (!foundViaSelector && this.config.fallbackKeywords) {
        console.log(`[UniversalAdapter] Primary selectors failed for ${this.organizationName}, using heuristic fallback...`);
        
        $('a').each((i, el) => {
          const text = $(el).text().trim().toLowerCase();
          const href = $(el).attr('href');
          
          if (text && href) {
            const isMatch = this.config.fallbackKeywords.some(kw => text.includes(kw));
            if (isMatch && text.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
              const link = this.resolveUrl(href);
              if (!jobs.find(j => j.url === link)) {
                jobs.push({ title: text.substring(0, 200), url: link, fallback: true });
              }
            }
          }
        });
      }

      // 3. DEEP SCRAPE: Follow each job link and extract structured details
      const formattedJobs = [];
      const topJobs = jobs.slice(0, 5); // limit to top 5

      for (const j of topJobs) {
        console.log(`[DeepScrape] Extracting details from: ${j.url}`);
        let details = {};
        
        try {
          details = await this.scrapeDetailPage(j.url, j.jsonLdData);
        } catch (e) {
          console.log(`[DeepScrape] Failed to extract details from ${j.url}: ${e.message}`);
        }

        const currentYear = new Date().getFullYear();
        formattedJobs.push({
          recruitmentName: `${this.organizationName} Recruitment ${currentYear}`,
          postName: this.cleanTitle(j.title),
          status: details.status || 'ACTIVE',
          verificationStatus: 'NEEDS_VERIFICATION',
          
          // Dates (use extracted or null — never guess)
          applicationStartDate: details.applicationStartDate || null,
          applicationEndDate: details.applicationEndDate || null,
          examDate: details.examDate || null,
          notificationDate: details.notificationDate || null,
          
          // Compensation
          basicPay: details.basicPay || null,
          payScale: details.payScale || null,
          payLevel: details.payLevel || null,
          grossSalary: details.grossSalary || null,
          
          // Content
          description: details.description || null,
          selectionProcess: details.selectionProcess || null,
          examPattern: details.examPattern || null,
          qualificationSummary: details.qualificationSummary || null,
          
          // Numbers
          vacancies: details.vacancies || null,
          
          // Links
          officialApplicationUrl: j.url,
          sourceUrl: this.config.url,
          
          // Eligibility (nested)
          eligibilityRule: details.eligibilityRule || undefined,
        });
      }

      return formattedJobs;

    } catch (error) {
      console.log(`[UniversalAdapter] Fetch error for ${this.organizationName}: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DEEP SCRAPE: Follow job link and extract structured data
  // ═══════════════════════════════════════════════════════════════
  async scrapeDetailPage(url, jsonLdData = null) {
    let text = '';

    // Check if URL points to a PDF
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      text = await this.extractFromPdf(url);
    } else {
      text = await this.extractFromHtml(url);
    }

    if (!text || text.length < 50) {
      console.log(`[DeepScrape] Insufficient text extracted (${text.length} chars)`);
      return {};
    }

    console.log(`[DeepScrape] Extracted ${text.length} chars of text, running pattern matchers...`);

    // Run all extractors
    const dates = this.extractDates(text);
    const salary = this.extractSalary(text);
    const eligibility = this.extractEligibility(text);
    const vacancies = this.extractVacancies(text);
    const selectionProcess = this.extractSelectionProcess(text);
    const examPattern = this.extractExamPattern(text);
    const description = this.extractDescription(text);

    let structuredData = {};
    if (jsonLdData) {
      console.log(`[DeepScrape] Applying JSON-LD structured data`);
      if (jsonLdData.baseSalary) {
        structuredData.basicPay = typeof jsonLdData.baseSalary === 'object' 
          ? (jsonLdData.baseSalary.value?.value || jsonLdData.baseSalary.value) 
          : jsonLdData.baseSalary;
        if (structuredData.basicPay) structuredData.basicPay = `₹${structuredData.basicPay}`;
      }
      if (jsonLdData.description) structuredData.description = this.cleanTitle(jsonLdData.description);
      if (jsonLdData.datePosted) structuredData.notificationDate = new Date(jsonLdData.datePosted);
      if (jsonLdData.validThrough) structuredData.applicationEndDate = new Date(jsonLdData.validThrough);
    }

    return {
      ...dates,
      ...salary,
      ...eligibility.fields,
      eligibilityRule: eligibility.rule,
      vacancies,
      selectionProcess,
      examPattern,
      description,
      ...structuredData, // JSON-LD data takes precedence
    };
  }

  // ── PDF Extraction ──
  async extractFromPdf(url) {
    if (!pdfParse) {
      console.log('[DeepScrape] pdf-parse not available, skipping PDF');
      return '';
    }
    
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const data = await pdfParse(Buffer.from(response.data));
      console.log(`[DeepScrape] PDF parsed: ${data.numpages} pages, ${data.text.length} chars`);
      return data.text;
    } catch (e) {
      console.log(`[DeepScrape] PDF extraction failed: ${e.message}`);
      return '';
    }
  }

  // ── HTML Text Extraction ──
  async extractFromHtml(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 15000,
        httpsAgent,
      });

      const $ = cheerio.load(response.data);
      
      // Look for a prominent PDF link on the page before stripping
      let pdfLink = null;
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && (href.toLowerCase().endsWith('.pdf') || href.toLowerCase().includes('pdf'))) {
          const text = $(el).text().toLowerCase();
          if (text.includes('advertisement') || text.includes('notification') || text.includes('detail') || text.includes('click here')) {
            pdfLink = this.resolveUrl(href);
            return false; // break loop
          }
          if (!pdfLink) pdfLink = this.resolveUrl(href);
        }
      });

      // Remove noise
      $('script, style, nav, footer, header, .sidebar, .advertisement').remove();
      
      // Get clean text
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // If text is too short and we found a PDF, scrape the PDF instead
      if (text.length < 500 && pdfLink) {
        console.log(`[DeepScrape] HTML text too short (${text.length} chars). Falling back to linked PDF: ${pdfLink}`);
        const pdfText = await this.extractFromPdf(pdfLink);
        if (pdfText && pdfText.length > 100) {
          text = text + '\n' + pdfText;
        }
      }
      
      return text;
    } catch (e) {
      console.log(`[DeepScrape] HTML extraction failed: ${e.message}`);
      return '';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // REGEX EXTRACTORS
  // ═══════════════════════════════════════════════════════════════

  extractDates(text) {
    const result = {};
    
    // Common Indian date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD Month YYYY
    const datePatterns = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,
      /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*(\d{4})/gi,
    ];

    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };

    const parseIndianDate = (match) => {
      // Try DD/MM/YYYY format
      const numMatch = match.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (numMatch) {
        const [, day, month, year] = numMatch;
        const y = parseInt(year);
        if (y >= 2025 && y <= 2027) {
          return new Date(y, parseInt(month) - 1, parseInt(day));
        }
      }
      
      // Try DD Month YYYY format
      const textMatch = match.match(/^(\d{1,2})\s+([a-z]+)\s*,?\s*(\d{4})$/i);
      if (textMatch) {
        const [, day, monthStr, year] = textMatch;
        const m = monthMap[monthStr.toLowerCase()];
        const y = parseInt(year);
        if (m !== undefined && y >= 2025 && y <= 2027) {
          return new Date(y, m, parseInt(day));
        }
      }
      return null;
    };

    // Extract all dates from text
    const allDates = [];
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const parsed = parseIndianDate(match[0]);
        if (parsed && !isNaN(parsed.getTime())) {
          allDates.push({ date: parsed, context: text.substring(Math.max(0, match.index - 80), match.index + match[0].length + 20).toLowerCase() });
        }
      }
    }

    // Map dates to fields based on surrounding context
    for (const { date, context } of allDates) {
      if (!result.applicationEndDate && (context.includes('last date') || context.includes('closing date') || context.includes('deadline') || context.includes('last date for') || context.includes('end date'))) {
        result.applicationEndDate = date;
      } else if (!result.applicationStartDate && (context.includes('start date') || context.includes('opening date') || context.includes('commencement') || context.includes('apply from'))) {
        result.applicationStartDate = date;
      } else if (!result.examDate && (context.includes('exam') || context.includes('test date') || context.includes('written test') || context.includes('cbt'))) {
        result.examDate = date;
      } else if (!result.notificationDate && (context.includes('notification') || context.includes('published') || context.includes('advertis'))) {
        result.notificationDate = date;
      }
    }

    // If we found dates but couldn't assign, use heuristics
    if (allDates.length > 0 && !result.applicationEndDate) {
      // Pick the latest future date as likely deadline
      const futureDates = allDates.filter(d => d.date > new Date()).sort((a, b) => a.date - b.date);
      if (futureDates.length > 0) {
        result.applicationEndDate = futureDates[0].date;
      }
    }

    return result;
  }

  extractSalary(text) {
    const result = {};
    const lower = text.toLowerCase();

    // ₹ or Rs. followed by numbers
    const salaryPatterns = [
      /(?:basic\s*pay|basic\s*salary)[:\s]*(?:₹|rs\.?\s*)([0-9,]+(?:\/-)?)/i,
      /(?:pay\s*scale)[:\s]*(?:₹|rs\.?\s*)([0-9,]+)\s*[-–to]+\s*(?:₹|rs\.?\s*)([0-9,]+)/i,
      /(?:pay\s*level|pay\s*band)[:\s]*(?:level\s*)?(\d+)/i,
      /(?:gross\s*salary|gross\s*pay|gross\s*emolument)[:\s]*(?:₹|rs\.?\s*)([0-9,]+)/i,
      /(?:ctc|cost\s*to\s*company)[:\s]*(?:₹|rs\.?\s*)([0-9,]+(?:\s*(?:lpa|lakhs?|l\.?p\.?a\.?))?)/i,
      /(?:₹|rs\.?\s*)([0-9,]+(?:\/-)?)\s*(?:per\s*month|p\.?m\.?|monthly)/i,
    ];

    // Basic Pay
    const basicMatch = text.match(/(?:basic\s*pay|basic\s*salary|initial\s*pay)[:\s]*(?:₹|rs\.?\s*)([0-9,]+)/i);
    if (basicMatch) {
      result.basicPay = `₹${basicMatch[1].replace(/,/g, '').replace(/\/$/, '')}`;
      // Format with commas
      const num = parseInt(result.basicPay.replace(/[₹,]/g, ''));
      if (!isNaN(num)) result.basicPay = `₹${num.toLocaleString('en-IN')}`;
    }

    // Pay Scale
    const scaleMatch = text.match(/(?:pay\s*(?:scale|band|range))[:\s]*(?:₹|rs\.?\s*)([0-9,]+)\s*[-–to]+\s*(?:₹|rs\.?\s*)([0-9,]+)/i);
    if (scaleMatch) {
      const low = parseInt(scaleMatch[1].replace(/,/g, ''));
      const high = parseInt(scaleMatch[2].replace(/,/g, ''));
      result.payScale = `₹${low.toLocaleString('en-IN')} - ₹${high.toLocaleString('en-IN')}`;
    }

    // Pay Level
    const levelMatch = text.match(/(?:pay\s*level|level)[:\s-]*(?:level\s*)?(\d{1,2})/i);
    if (levelMatch) {
      result.payLevel = `Pay Level ${levelMatch[1]}`;
    }

    // Gross Salary
    const grossMatch = text.match(/(?:gross|total\s*emolument|approx(?:imate)?(?:\s*salary)?)[:\s]*(?:₹|rs\.?\s*)([0-9,]+)/i);
    if (grossMatch) {
      const num = parseInt(grossMatch[1].replace(/,/g, ''));
      result.grossSalary = `₹${num.toLocaleString('en-IN')} (approx)`;
    }

    // CTC
    const ctcMatch = text.match(/(?:ctc|cost\s*to\s*company)[:\s]*(?:₹|rs\.?\s*)?([0-9,.]+)\s*(?:lpa|lakhs?|l\.?p\.?a\.?)/i);
    if (ctcMatch) {
      result.ctc = `₹${ctcMatch[1]} LPA`;
    }

    // Fallback: if no basic pay found, try to find any prominent salary figure
    if (!result.basicPay && !result.payScale) {
      const anyPay = text.match(/(?:₹|rs\.?\s*)([0-9,]{4,}(?:\/-)?)\s*(?:per\s*month|p\.?m\.?|monthly|consolidated)/i);
      if (anyPay) {
        const num = parseInt(anyPay[1].replace(/[,\/\-]/g, ''));
        if (num >= 10000 && num <= 500000) {
          result.basicPay = `₹${num.toLocaleString('en-IN')}`;
        }
      }
    }

    return result;
  }

  extractEligibility(text) {
    const result = { fields: {}, rule: undefined };

    // Age
    let minAge = null, maxAge = null;
    const ageMatch = text.match(/(?:age\s*(?:limit|range)?)[:\s]*(\d{2})\s*[-–to]+\s*(\d{2})\s*(?:years?)?/i);
    if (ageMatch) {
      minAge = parseInt(ageMatch[1]);
      maxAge = parseInt(ageMatch[2]);
    } else {
      const maxAgeMatch = text.match(/(?:not\s*exceeding|maximum\s*age|upper\s*age)[:\s]*(\d{2})\s*(?:years?)?/i);
      if (maxAgeMatch) maxAge = parseInt(maxAgeMatch[1]);
      const minAgeMatch = text.match(/(?:minimum\s*age|lower\s*age)[:\s]*(\d{2})\s*(?:years?)?/i);
      if (minAgeMatch) minAge = parseInt(minAgeMatch[1]);
    }

    // Degrees
    let degrees = null;
    const degreePatterns = [
      /(?:qualification|educational\s*qualification|degree)[:\s]*([^\n.]{10,80})/i,
      /(?:b\.?tech|b\.?e\.?|mca|m\.?tech|bca|b\.?sc|diploma)[\s,\/&]*/gi,
    ];
    const degreeMatch = text.match(/(?:b\.?tech|b\.?e\.?|mca|m\.?tech|bca|b\.?sc|diploma)(?:\s*[\/,&]\s*(?:b\.?tech|b\.?e\.?|mca|m\.?tech|bca|b\.?sc|diploma))*/gi);
    if (degreeMatch && degreeMatch.length > 0) {
      // Deduplicate and normalize
      const unique = [...new Set(degreeMatch.map(d => d.replace(/\s+/g, '').toUpperCase()
        .replace('BTECH', 'B.Tech').replace('BE', 'B.E.').replace('BSC', 'B.Sc')
        .replace('MTECH', 'M.Tech').replace('DIPLOMA', 'Diploma')))];
      degrees = unique.join(', ');
    }

    // Branches
    let branches = null;
    const branchMatch = text.match(/(?:branch|discipline|stream|specialization)[:\s]*([^\n.]{10,120})/i);
    if (branchMatch) {
      branches = branchMatch[1].trim().replace(/\s+/g, ' ');
      // Filter out obvious noise like navigation text or Hindi
      branches = branches.replace(/\b(?:Home|Careers|Advertisement|विज्ञापन).*/i, '').trim();
      if (branches.length > 50) branches = branches.substring(0, 47) + '...';
      if (branches.length < 3) branches = null;
    }
    if (!branches) {
      // Try to find common CS/IT branch mentions
      const csBranches = [];
      if (/computer\s*science/i.test(text)) csBranches.push('Computer Science');
      if (/information\s*technology/i.test(text)) csBranches.push('Information Technology');
      if (/electronics/i.test(text)) csBranches.push('Electronics');
      if (/electrical/i.test(text)) csBranches.push('Electrical');
      if (csBranches.length > 0) branches = csBranches.join(', ');
    }

    // Min percentage
    let minPercentage = null;
    const percMatch = text.match(/(\d{2})%?\s*(?:marks?|aggregate|minimum)/i) ||
                      text.match(/(?:minimum|at\s*least|not\s*less\s*than)\s*(\d{2})\s*%/i);
    if (percMatch) {
      const p = parseInt(percMatch[1]);
      if (p >= 50 && p <= 90) minPercentage = p;
    }

    // Qualification summary
    const qualMatch = text.match(/(?:educational\s*qualification|qualification\s*required|eligibility)[:\s]*([^\n]{15,150})/i);
    if (qualMatch) {
      let qual = qualMatch[1].trim().replace(/\s+/g, ' ').substring(0, 150);
      // Filter out noise (file sizes, KB, download links)
      if (!/\d+.*KB|download|click here|\.pdf/i.test(qual)) {
        result.fields.qualificationSummary = qual;
      }
    }
    // Fallback: build from extracted degrees and branches
    if (!result.fields.qualificationSummary && (degrees || branches)) {
      const parts = [];
      if (degrees) parts.push(degrees);
      if (branches) parts.push(`in ${branches}`);
      result.fields.qualificationSummary = parts.join(' ');
    }

    // Build eligibility rule if we have any data
    if (degrees || branches || minAge || maxAge || minPercentage) {
      result.rule = {};
      if (degrees) result.rule.allowedDegrees = degrees;
      if (branches) result.rule.allowedBranches = branches;
      if (minAge) result.rule.minAge = minAge;
      if (maxAge) result.rule.maxAge = maxAge;
      if (minPercentage) result.rule.minPercentage = minPercentage;
    }

    return result;
  }

  extractVacancies(text) {
    const patterns = [
      /(?:total\s*(?:no\.?\s*(?:of)?\s*)?(?:vacancies|posts?|positions?))[:\s]*(\d+)/i,
      /(?:no\.?\s*(?:of)?\s*(?:vacancies|posts?|positions?))[:\s]*(\d+)/i,
      /(\d+)\s*(?:vacancies|posts?|positions?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > 0 && num < 100000) return num;
      }
    }
    return null;
  }

  extractSelectionProcess(text) {
    const patterns = [
      /(?:selection\s*(?:process|procedure|criteria|methodology))[:\s]*([^\n]{10,200})/i,
      /(?:mode\s*of\s*selection)[:\s]*([^\n]{10,200})/i,
      /(?:scheme\s*of\s*(?:examination|selection))[:\s]*([^\n]{10,200})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let process = match[1].trim().replace(/\s+/g, ' ');
        // Clean up and add arrows
        process = process.replace(/\s*[,;]\s*/g, ' → ').replace(/\s*and\s*/gi, ' → ');
        return process.substring(0, 200);
      }
    }

    // Heuristic: look for common selection steps
    const steps = [];
    if (/written\s*(?:test|exam)/i.test(text)) steps.push('Written Test');
    if (/online\s*(?:test|exam|cbt)/i.test(text)) steps.push('Online Exam');
    if (/prelim/i.test(text)) steps.push('Prelims');
    if (/mains/i.test(text)) steps.push('Mains');
    if (/interview/i.test(text)) steps.push('Interview');
    if (/group\s*discussion|gd\b/i.test(text)) steps.push('GD');
    if (/medical/i.test(text)) steps.push('Medical');
    if (/document\s*verification/i.test(text)) steps.push('Document Verification');
    if (/merit\s*list/i.test(text)) steps.push('Final Merit');
    
    if (steps.length >= 2) return steps.join(' → ');
    return null;
  }

  extractExamPattern(text) {
    const patterns = [
      /(?:exam\s*pattern|pattern\s*of\s*exam(?:ination)?|scheme\s*of\s*exam(?:ination)?)[:\s]*([^\n]{15,300})/i,
      /(?:paper\s*[iI1])[:\s]*([^\n]{10,200})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim().replace(/\s+/g, ' ').substring(0, 300);
      }
    }
    return null;
  }

  extractDescription(text) {
    // Try to find an "About" or introductory paragraph
    const patterns = [
      /(?:about\s*(?:the\s*)?(?:recruitment|post|position))[:\s]*([^\n]{30,300})/i,
      /(?:applications?\s*(?:are|is)\s*invited)[^.]*\./i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim().replace(/\s+/g, ' ').substring(0, 300);
      }
    }

    // Fallback: grab the first meaningful paragraph (>50 chars)
    const sentences = text.split(/\.\s+/);
    for (const s of sentences) {
      const clean = s.trim();
      if (clean.length > 50 && clean.length < 400 && /recruit|appoint|vacanc|post|application/i.test(clean)) {
        return clean + '.';
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  resolveUrl(href) {
    if (href.startsWith('http')) return href;
    try {
      const baseUrl = new URL(this.config.url);
      if (href.startsWith('/')) {
        return `${baseUrl.origin}${href}`;
      }
      return `${baseUrl.origin}/${href}`;
    } catch (e) {
      return href;
    }
  }

  cleanTitle(str) {
    let clean = str.replace(/<[^>]*>?/gm, '').replace(/^[>"]+/, '');
    clean = clean.replace(/_/g, ' ').replace(/\.html|\.pdf|\.aspx|\.php/gi, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    clean = clean.replace(/\b\w/g, l => l.toUpperCase());
    
    const lower = clean.toLowerCase();
    if (lower === 'recruitment' || lower === 'careers' || lower === 'apply' || clean.length < 3) {
      clean = `${this.organizationName} General Recruitment`;
    }
    
    return clean.substring(0, 100).trim();
  }
}

module.exports = UniversalAdapter;
