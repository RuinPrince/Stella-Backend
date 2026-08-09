const prisma = require('../src/lib/prisma.js');

async function main() {
  console.log('🌱 Seeding Database...\n');

  // ==========================================
  // 1. YOUR Personal Profile
  // ==========================================
  const profile = await prisma.profile.create({
    data: {
      education: 'B.Tech',
      branch: 'Information Technology',
      graduationYear: 2027,
      dateOfBirth: new Date('2005-01-15'),
      country: 'India',
      state: 'Tamil Nadu',
      primaryInterests: 'Government,Banking,PSU,Railway,Technical,IT,Private',
      salaryPreference: '50000',
    }
  });
  console.log('✅ Created your profile.');

  // ==========================================
  // 2. Syllabus (Subjects & Topics)
  // ==========================================
  const syllabusData = [
    { name: 'Data Structures & Algorithms', topics: ['Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs', 'Sorting & Searching', 'Dynamic Programming', 'Hashing', 'Recursion & Backtracking'] },
    { name: 'Database Management Systems', topics: ['ER Model & Relational Model', 'SQL Queries', 'Normalization (1NF-BCNF)', 'Transactions & Concurrency', 'Indexing & B-Trees', 'NoSQL Basics'] },
    { name: 'Operating Systems', topics: ['Processes & Threads', 'CPU Scheduling', 'Deadlocks', 'Memory Management', 'File Systems', 'Disk Scheduling'] },
    { name: 'Computer Networks', topics: ['OSI & TCP/IP Model', 'IP Addressing & Subnetting', 'Routing Protocols', 'Transport Layer (TCP/UDP)', 'Network Security & Firewalls', 'DNS, DHCP, HTTP'] },
    { name: 'Software Engineering', topics: ['SDLC Models', 'Agile & Scrum', 'UML Diagrams', 'Testing Strategies', 'Software Metrics'] },
    { name: 'Computer Organization', topics: ['Number Systems', 'CPU Architecture', 'Pipelining', 'Cache & Memory Hierarchy', 'I/O Systems'] },
    { name: 'Cyber Security', topics: ['Cryptography Basics', 'Network Security Protocols', 'Authentication & Authorization', 'Threats & Vulnerabilities', 'Firewall & IDS/IPS'] },
    { name: 'Cloud Computing', topics: ['AWS/Azure/GCP Basics', 'Virtualization', 'Containerization (Docker)', 'Serverless Architecture', 'Cloud Security'] },
    { name: 'Programming & Web Technologies', topics: ['OOP Concepts', 'Java/Python Fundamentals', 'HTML/CSS/JavaScript', 'REST APIs', 'Version Control (Git)'] },
    { name: 'Quantitative Aptitude', topics: ['Number System & Simplification', 'Percentage, Profit & Loss', 'Ratio & Proportion', 'Time, Speed & Distance', 'Time & Work', 'Data Interpretation', 'Averages & Mixtures', 'Algebra & Geometry'] },
    { name: 'Reasoning & Logic', topics: ['Puzzles & Seating Arrangement', 'Syllogism', 'Blood Relations', 'Direction Sense', 'Coding-Decoding', 'Data Sufficiency', 'Logical Reasoning', 'Analytical Reasoning'] },
    { name: 'General English', topics: ['Reading Comprehension', 'Grammar & Error Spotting', 'Vocabulary (Synonyms & Antonyms)', 'Cloze Test & Fill in Blanks', 'Para Jumbles', 'Sentence Correction'] },
    { name: 'General Awareness', topics: ['Current Affairs (Last 6 months)', 'Banking Awareness', 'Financial Awareness', 'Indian Economy', 'General Science', 'Indian Polity & Constitution', 'History & Geography'] },
  ];

  const topicMap = {};
  for (const sub of syllabusData) {
    const subject = await prisma.subject.create({ data: { name: sub.name } });
    for (const topicName of sub.topics) {
      const topic = await prisma.topic.create({ data: { name: topicName, subjectId: subject.id } });
      topicMap[topicName] = topic.id;
      await prisma.topicProgress.create({ data: { topicId: topic.id, status: 'NOT_STARTED' } });
    }
  }
  console.log('✅ Created syllabus with', Object.keys(topicMap).length, 'topics.');

  // ==========================================
  // 3. Organizations
  // ==========================================
  const orgData = [
    { name: 'IBPS', sector: 'Banking', officialUrl: 'https://www.ibps.in/' },
    { name: 'SBI', sector: 'Banking', officialUrl: 'https://www.sbi.co.in/careers' },
    { name: 'RBI', sector: 'Banking', officialUrl: 'https://www.rbi.org.in/' },
    { name: 'SSC', sector: 'Government', officialUrl: 'https://ssc.gov.in/' },
    { name: 'RRB (Railways)', sector: 'Railway', officialUrl: 'https://www.rrbcdg.gov.in/' },
    { name: 'TNPSC', sector: 'Government', officialUrl: 'https://www.tnpsc.gov.in/' },
    { name: 'ISRO', sector: 'Government', officialUrl: 'https://www.isro.gov.in/' },
    { name: 'DRDO', sector: 'Government', officialUrl: 'https://www.drdo.gov.in/' },
    { name: 'NIC', sector: 'Government', officialUrl: 'https://www.nic.in/' },
    { name: 'NIELIT', sector: 'Government', officialUrl: 'https://www.nielit.gov.in/' },
    { name: 'ONGC', sector: 'PSU', officialUrl: 'https://www.ongcindia.com/' },
    { name: 'BHEL', sector: 'PSU', officialUrl: 'https://www.bhel.com/' },
    { name: 'BEL', sector: 'PSU', officialUrl: 'https://www.bel-india.in/' },
    { name: 'NTPC', sector: 'PSU', officialUrl: 'https://www.ntpc.co.in/' },
    { name: 'Power Grid', sector: 'PSU', officialUrl: 'https://www.powergrid.in/' },
    { name: 'TCS', sector: 'Private', officialUrl: 'https://www.tcs.com/careers' },
    { name: 'Infosys', sector: 'Private', officialUrl: 'https://www.infosys.com/careers/' },
    { name: 'Zoho', sector: 'Private', officialUrl: 'https://www.zoho.com/careers.html' },
    { name: 'Google', sector: 'Private', officialUrl: 'https://careers.google.com/' },
    { name: 'Microsoft', sector: 'Private', officialUrl: 'https://careers.microsoft.com/' },
  ];

  const orgMap = {};
  for (const org of orgData) {
    const created = await prisma.organization.create({ data: org });
    orgMap[org.name] = created.id;
  }
  console.log('✅ Created', Object.keys(orgMap).length, 'organizations.');

  // ==========================================
  // 4. Recruitments
  // ==========================================
  const now = new Date();
  const days = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const recruitments = [
    { org: 'IBPS', recruitmentName: 'CRP SPL-XIV', postName: 'IT Officer (Scale-I)', sector: 'Banking', jobType: 'Specialist Officer', vacancies: 120, description: 'Recruitment of IT Officers in participating public sector banks.', qualificationSummary: 'B.Tech/B.E. in CS/IT/Electronics or MCA', basicPay: '₹36,000', payScale: '₹36,000 - ₹63,840', grossSalary: '₹52,000 - ₹55,000 (approx)', applicationStartDate: days(-10), applicationEndDate: days(12), examDate: days(60), notificationDate: days(-15), selectionProcess: 'Online Exam → Interview → Final Merit List', examPattern: 'Professional Knowledge (IT): 60Q/60M | Reasoning: 50Q/25M | English: 50Q/25M | Quantitative Aptitude: 50Q/25M | General Awareness: 40Q/40M', status: 'OPEN', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://ibps.in/crp-spl-xiv/', officialApplicationUrl: 'https://ibpsonline.ibps.in/crpspl14/', sourceUrl: 'https://ibps.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., MCA', allowedBranches: 'Information Technology, Computer Science, Electronics, Computer Applications', maxAge: 30, minAge: 20 }, examTopics: ['Arrays & Strings', 'SQL Queries', 'Normalization (1NF-BCNF)', 'Processes & Threads', 'CPU Scheduling', 'OSI & TCP/IP Model', 'Network Security & Firewalls', 'Puzzles & Seating Arrangement', 'Data Interpretation', 'Reading Comprehension', 'Banking Awareness'] },
    { org: 'IBPS', recruitmentName: 'IBPS PO CRP-XIV', postName: 'Probationary Officer', sector: 'Banking', jobType: 'Officer', vacancies: 4500, description: 'Probationary Officer recruitment in participating public sector banks.', qualificationSummary: 'Any Graduate', basicPay: '₹36,000', payScale: '₹36,000 - ₹63,840', grossSalary: '₹52,000 (approx)', applicationStartDate: days(-5), applicationEndDate: days(18), examDate: days(75), notificationDate: days(-10), selectionProcess: 'Prelims → Mains → Interview → Final Merit', examPattern: 'Prelims: Reasoning 35Q | Quant 35Q | English 30Q\nMains: Reasoning & CA 45Q | DI 35Q | English 35Q | GA 40Q | Computer 20Q', status: 'OPEN', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://ibps.in/crp-po-xiv/', officialApplicationUrl: 'https://ibpsonline.ibps.in/crppo14/', sourceUrl: 'https://ibps.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., B.Sc, B.Com, BA, BCA, MCA', allowedBranches: 'Any', maxAge: 30, minAge: 20 }, examTopics: ['Puzzles & Seating Arrangement', 'Syllogism', 'Data Interpretation', 'Number System & Simplification', 'Percentage, Profit & Loss', 'Reading Comprehension', 'Grammar & Error Spotting', 'Current Affairs (Last 6 months)', 'Banking Awareness'] },
    { org: 'SBI', recruitmentName: 'SBI Specialist Cadre Officer', postName: 'Assistant Manager (Systems)', sector: 'Banking', jobType: 'Specialist Officer', vacancies: 45, description: 'System administrator and network management roles at SBI.', qualificationSummary: 'B.Tech/B.E. in CS/IT/ECE', basicPay: '₹48,170', payScale: '₹48,170 - ₹69,810', grossSalary: '₹65,000 - ₹70,000 (approx)', applicationStartDate: days(5), applicationEndDate: days(30), examDate: days(90), notificationDate: days(2), selectionProcess: 'Shortlisting → Online Test → Interview → Final Merit', examPattern: 'Professional Knowledge (IT): 75Q/150M | General Aptitude: 25Q/50M | Total: 200 marks', status: 'UPCOMING', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.sbi.co.in/web/careers/current-openings', sourceUrl: 'https://www.sbi.co.in/careers', eligibility: { allowedDegrees: 'B.Tech, B.E.', allowedBranches: 'Information Technology, Computer Science, Electronics & Communication', maxAge: 32, minAge: 21 }, examTopics: ['SQL Queries', 'Normalization (1NF-BCNF)', 'Processes & Threads', 'Deadlocks', 'OSI & TCP/IP Model', 'Network Security & Firewalls', 'Cryptography Basics', 'AWS/Azure/GCP Basics', 'SDLC Models'] },
    { org: 'SSC', recruitmentName: 'SSC CGL 2026', postName: 'Assistant Section Officer / Inspector', sector: 'Government', jobType: 'Group B/C', vacancies: 8000, description: 'Combined Graduate Level exam for various central government ministries.', qualificationSummary: 'Any Graduate', basicPay: '₹44,900', payLevel: 'Pay Level 7', payScale: '₹44,900 - ₹1,42,400', grossSalary: '₹65,000 - ₹75,000 (approx with DA/HRA)', applicationStartDate: days(-3), applicationEndDate: days(25), examDate: days(80), notificationDate: days(-7), selectionProcess: 'Tier I (CBT) → Tier II (CBT) → Document Verification → Final Merit', examPattern: 'Tier I: Reasoning 25Q | GK 25Q | Quant 25Q | English 25Q (60 min)\nTier II: Math/Stats 30Q | Reasoning 30Q | English 45Q | GK 25Q | CS 20Q (150 min)', status: 'OPEN', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://ssc.gov.in/noticeboards', sourceUrl: 'https://ssc.gov.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., B.Sc, B.Com, BA, BCA, MCA', allowedBranches: 'Any', maxAge: 30, minAge: 18 }, examTopics: ['Number System & Simplification', 'Percentage, Profit & Loss', 'Ratio & Proportion', 'Time, Speed & Distance', 'Puzzles & Seating Arrangement', 'Syllogism', 'Coding-Decoding', 'Reading Comprehension', 'Grammar & Error Spotting', 'Current Affairs (Last 6 months)', 'Indian Economy', 'Indian Polity & Constitution'] },
    { org: 'RRB (Railways)', recruitmentName: 'RRB JE CBT 2026', postName: 'Junior Engineer (IT)', sector: 'Railway', jobType: 'Technical', vacancies: 150, description: 'Junior Engineer recruitment for Railway IT infrastructure.', qualificationSummary: 'B.Tech/B.E./Diploma in CS/IT/ECE', basicPay: '₹35,400', payLevel: 'Pay Level 6', payScale: '₹35,400 - ₹1,12,400', grossSalary: '₹50,000 - ₹55,000 (approx)', applicationStartDate: days(10), applicationEndDate: days(40), examDate: days(100), notificationDate: days(8), selectionProcess: 'CBT Stage I → CBT Stage II → Document Verification → Medical', examPattern: 'CBT I: Math 30Q | GI&Reasoning 25Q | GA&Current 15Q | General Science 30Q (90 min)\nCBT II: Technical (IT) 100Q | GI&Reasoning 25Q | GA&Current 15Q | Math/Basic Science 10Q (120 min)', status: 'UPCOMING', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.rrbcdg.gov.in/', sourceUrl: 'https://www.rrbcdg.gov.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., Diploma', allowedBranches: 'Information Technology, Computer Science, Electronics', maxAge: 32, minAge: 18 }, examTopics: ['Arrays & Strings', 'Linked Lists', 'SQL Queries', 'Processes & Threads', 'OSI & TCP/IP Model', 'IP Addressing & Subnetting', 'CPU Architecture', 'Number System & Simplification', 'Logical Reasoning'] },
    { org: 'TNPSC', recruitmentName: 'TNPSC Group 2 Services', postName: 'Assistant System Analyst / IT Officer', sector: 'Government', jobType: 'State Government', vacancies: 60, description: 'Tamil Nadu state government technical recruitment.', qualificationSummary: 'B.Tech/B.E./MCA in CS/IT', basicPay: '₹36,900', payLevel: 'Pay Level 10', payScale: '₹36,900 - ₹1,16,600', grossSalary: '₹55,000 - ₹60,000 (approx)', applicationStartDate: days(15), applicationEndDate: days(45), examDate: days(120), notificationDate: days(12), selectionProcess: 'Prelims → Mains → Interview → Counselling', examPattern: 'Prelims: Tamil & English 100Q | GK 100Q (3 hours)\nMains: Subject Paper (IT/CS) 200Q', status: 'UPCOMING', verificationStatus: 'NEEDS_VERIFICATION', officialNotificationUrl: 'https://www.tnpsc.gov.in/English/Notifications.aspx', sourceUrl: 'https://www.tnpsc.gov.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., MCA', allowedBranches: 'Information Technology, Computer Science', maxAge: 30, minAge: 18 }, examTopics: ['SQL Queries', 'OOP Concepts', 'SDLC Models', 'OSI & TCP/IP Model', 'Processes & Threads', 'Indian Polity & Constitution', 'History & Geography', 'Current Affairs (Last 6 months)'] },
    { org: 'ONGC', recruitmentName: 'ONGC GATE 2026 Recruitment', postName: 'AEE (IT / Computer Science)', sector: 'PSU', jobType: 'Through GATE', vacancies: 30, description: 'Assistant Executive Engineer recruitment through GATE CS/IT score.', qualificationSummary: 'B.Tech/B.E. in CS/IT with valid GATE score', basicPay: '₹60,000', payLevel: 'E-1 Grade', payScale: '₹60,000 - ₹1,80,000', grossSalary: '₹95,000 - ₹1,10,000 (approx with perks)', ctc: '₹15-18 LPA (approx)', applicationStartDate: days(-20), applicationEndDate: days(5), notificationDate: days(-25), selectionProcess: 'GATE Score Shortlist → GD/Interview → Medical → Final Merit', examPattern: 'Based on GATE CS paper: 65 Questions, 100 marks, 3 hours', status: 'CLOSING_SOON', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.ongcindia.com/wps/wcm/connect/en/careers/', sourceUrl: 'https://www.ongcindia.com/', eligibility: { allowedDegrees: 'B.Tech, B.E.', allowedBranches: 'Information Technology, Computer Science', maxAge: 28, minAge: 21, otherRequirements: 'Valid GATE CS score required' }, examTopics: ['Dynamic Programming', 'Sorting & Searching', 'Trees & Graphs', 'SQL Queries', 'Normalization (1NF-BCNF)', 'Transactions & Concurrency', 'Processes & Threads', 'Deadlocks', 'Memory Management', 'OSI & TCP/IP Model', 'Routing Protocols', 'CPU Architecture', 'Pipelining'] },
    { org: 'BEL', recruitmentName: 'BEL Probationary Engineer 2026', postName: 'Probationary Engineer (IT)', sector: 'PSU', jobType: 'Through GATE', vacancies: 40, description: 'Defence PSU recruitment for IT engineers.', qualificationSummary: 'B.Tech/B.E. in CS/IT/ECE with valid GATE score', basicPay: '₹40,000', payLevel: 'E-II Grade', grossSalary: '₹60,000 - ₹65,000 (approx)', ctc: '₹10-12 LPA (approx)', applicationStartDate: days(20), applicationEndDate: days(50), notificationDate: days(18), selectionProcess: 'GATE Score Shortlist → Interview → Medical → Final Merit', examPattern: 'Based on GATE CS/ECE paper score', status: 'UPCOMING', verificationStatus: 'NEEDS_VERIFICATION', officialNotificationUrl: 'https://www.bel-india.in/ContentPage.aspx?MId=19', sourceUrl: 'https://www.bel-india.in/', eligibility: { allowedDegrees: 'B.Tech, B.E.', allowedBranches: 'Information Technology, Computer Science, Electronics', maxAge: 25, minAge: 21, otherRequirements: 'Valid GATE score required' }, examTopics: ['Arrays & Strings', 'SQL Queries', 'Processes & Threads', 'OSI & TCP/IP Model', 'CPU Architecture', 'Cryptography Basics', 'Network Security & Firewalls'] },
    { org: 'NIC', recruitmentName: 'NIC Scientist-B Recruitment', postName: 'Scientist-B (IT/CS)', sector: 'Government', jobType: 'Technical', vacancies: 100, description: 'National Informatics Centre recruitment for software development and e-governance.', qualificationSummary: 'B.Tech/B.E./MCA in CS/IT', basicPay: '₹56,100', payLevel: 'Pay Level 10', payScale: '₹56,100 - ₹1,77,500', grossSalary: '₹80,000 - ₹90,000 (approx)', applicationStartDate: days(30), applicationEndDate: days(60), examDate: days(130), notificationDate: days(28), selectionProcess: 'Written Exam → Interview → Final Merit', examPattern: 'Paper I: CS/IT 100Q (200 marks) | Paper II: GK & Aptitude 50Q (100 marks)', status: 'UPCOMING', verificationStatus: 'NEEDS_VERIFICATION', officialNotificationUrl: 'https://www.nic.in/careers/', sourceUrl: 'https://www.nic.in/', eligibility: { allowedDegrees: 'B.Tech, B.E., MCA', allowedBranches: 'Information Technology, Computer Science', maxAge: 30, minAge: 21 }, examTopics: ['Dynamic Programming', 'Hashing', 'SQL Queries', 'Normalization (1NF-BCNF)', 'Processes & Threads', 'OSI & TCP/IP Model', 'OOP Concepts', 'Java/Python Fundamentals', 'REST APIs', 'SDLC Models', 'AWS/Azure/GCP Basics'] },
    { org: 'ISRO', recruitmentName: 'ISRO Scientist/Engineer SC', postName: 'Scientist/Engineer (CS)', sector: 'Government', jobType: 'Technical', vacancies: 25, description: 'ISRO recruitment for computer science engineers.', qualificationSummary: 'B.Tech/B.E. in CS/IT (65% minimum)', basicPay: '₹56,100', payLevel: 'Pay Level 10', grossSalary: '₹85,000 - ₹1,00,000 (approx)', applicationStartDate: days(40), applicationEndDate: days(70), examDate: days(140), notificationDate: days(38), selectionProcess: 'Written Test → Interview → Final Merit', examPattern: 'CS/IT Technical: 80Q (Multiple Choice) | Duration: 90 min', status: 'UPCOMING', verificationStatus: 'NEEDS_VERIFICATION', officialNotificationUrl: 'https://www.isro.gov.in/careers.html', sourceUrl: 'https://www.isro.gov.in/', eligibility: { allowedDegrees: 'B.Tech, B.E.', allowedBranches: 'Computer Science, Information Technology', maxAge: 28, minAge: 18, minPercentage: 65 }, examTopics: ['Dynamic Programming', 'Trees & Graphs', 'Sorting & Searching', 'SQL Queries', 'Transactions & Concurrency', 'Processes & Threads', 'Deadlocks', 'Memory Management', 'OSI & TCP/IP Model', 'Routing Protocols', 'CPU Architecture', 'Pipelining', 'Cache & Memory Hierarchy', 'OOP Concepts'] },
    { org: 'TCS', recruitmentName: 'TCS Digital Off-Campus 2026', postName: 'Systems Engineer (Digital)', sector: 'Private', jobType: 'Off-Campus Drive', vacancies: 5000, description: 'TCS Digital hiring for top-tier engineering graduates.', qualificationSummary: 'B.Tech/B.E. (60% throughout)', basicPay: '₹58,000', ctc: '₹7-9 LPA', applicationStartDate: days(-7), applicationEndDate: days(20), examDate: days(35), notificationDate: days(-10), selectionProcess: 'TCS NQT (National Qualifier Test) → Technical Interview → HR Interview', examPattern: 'NQT: Coding 2Q | Aptitude 26Q | Reasoning 22Q | Verbal 24Q | Programming Logic 10Q | Advanced Coding 1Q', status: 'OPEN', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.tcs.com/careers/tcs-nqt', sourceUrl: 'https://www.tcs.com/careers', eligibility: { allowedDegrees: 'B.Tech, B.E., MCA', allowedBranches: 'Any', maxAge: 28, minAge: 18, minPercentage: 60 }, examTopics: ['Dynamic Programming', 'Arrays & Strings', 'SQL Queries', 'OOP Concepts', 'Java/Python Fundamentals', 'REST APIs', 'AWS/Azure/GCP Basics', 'Number System & Simplification', 'Logical Reasoning', 'Reading Comprehension'] },
    { org: 'Infosys', recruitmentName: 'Infosys Power Programmer', postName: 'Specialist Programmer', sector: 'Private', jobType: 'Off-Campus Drive', vacancies: 2000, description: 'Infosys hiring for power programmers.', qualificationSummary: 'B.Tech/B.E. (65% throughout)', basicPay: '₹50,000', ctc: '₹6.5-9 LPA', applicationStartDate: days(5), applicationEndDate: days(30), examDate: days(50), notificationDate: days(3), selectionProcess: 'InfyTQ Assessment → Coding Round → Technical Interview → HR', examPattern: 'InfyTQ: MCQ (Aptitude + Technical) | Coding: 3 problems (60 min) | Hands-on: Debug + DBMS', status: 'UPCOMING', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.infosys.com/careers/graduates.html', sourceUrl: 'https://www.infosys.com/careers/', eligibility: { allowedDegrees: 'B.Tech, B.E.', allowedBranches: 'Any', maxAge: 28, minAge: 18, minPercentage: 65 }, examTopics: ['Dynamic Programming', 'Recursion & Backtracking', 'Trees & Graphs', 'SQL Queries', 'OOP Concepts', 'Java/Python Fundamentals', 'REST APIs', 'Logical Reasoning', 'Reading Comprehension'] },
    { org: 'Zoho', recruitmentName: 'Zoho Off-Campus 2026', postName: 'Member Technical Staff', sector: 'Private', jobType: 'Off-Campus Drive', vacancies: 500, description: 'Zoho recruitment for technical staff.', qualificationSummary: 'B.Tech/B.E./BCA/MCA (No percentage cutoff)', ctc: '₹5-8 LPA', applicationStartDate: days(10), applicationEndDate: days(35), examDate: days(45), notificationDate: days(8), selectionProcess: 'Zoho Aptitude Test → Programming Round → Advanced Programming → Technical Interview → HR', examPattern: 'Round 1: Aptitude (25Q, 40min) | Round 2: C Programming (10Q, 45min) | Round 3: Advanced Coding (5Q, 3hr)', status: 'UPCOMING', verificationStatus: 'VERIFIED_FROM_OFFICIAL_SOURCE', officialNotificationUrl: 'https://www.zoho.com/careers.html', sourceUrl: 'https://www.zoho.com/careers.html', eligibility: { allowedDegrees: 'B.Tech, B.E., BCA, MCA', allowedBranches: 'Any', maxAge: 28, minAge: 18 }, examTopics: ['Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs', 'Dynamic Programming', 'Hashing', 'OOP Concepts', 'Java/Python Fundamentals', 'SQL Queries', 'Logical Reasoning'] },
  ];

  for (const rec of recruitments) {
    const createdRec = await prisma.recruitment.create({
      data: {
        organizationId: orgMap[rec.org], recruitmentName: rec.recruitmentName, postName: rec.postName,
        sector: rec.sector, jobType: rec.jobType, vacancies: rec.vacancies, description: rec.description,
        qualificationSummary: rec.qualificationSummary, basicPay: rec.basicPay || null,
        payLevel: rec.payLevel || null, payScale: rec.payScale || null, grossSalary: rec.grossSalary || null,
        ctc: rec.ctc || null, applicationStartDate: rec.applicationStartDate || null,
        applicationEndDate: rec.applicationEndDate || null, examDate: rec.examDate || null,
        notificationDate: rec.notificationDate || null, selectionProcess: rec.selectionProcess || null,
        examPattern: rec.examPattern || null, status: rec.status, verificationStatus: rec.verificationStatus,
        officialNotificationUrl: rec.officialNotificationUrl || null,
        officialApplicationUrl: rec.officialApplicationUrl || null, sourceUrl: rec.sourceUrl || null,
        eligibilityRule: { create: { allowedDegrees: rec.eligibility.allowedDegrees, allowedBranches: rec.eligibility.allowedBranches, maxAge: rec.eligibility.maxAge, minAge: rec.eligibility.minAge, minPercentage: rec.eligibility.minPercentage || null, otherRequirements: rec.eligibility.otherRequirements || null } },
        exam: rec.examDate ? { create: { name: rec.examPattern?.includes('Prelims') ? 'Prelims + Mains' : 'Online Examination', date: rec.examDate } } : undefined,
      },
      include: { exam: true }
    });

    if (createdRec.exam && rec.examTopics) {
      for (const topicName of rec.examTopics) {
        const tid = topicMap[topicName];
        if (tid) { await prisma.examTopic.create({ data: { examId: createdRec.exam.id, topicId: tid, weightage: 10 } }); }
      }
    }
  }
  console.log('✅ Created', recruitments.length, 'recruitments with exams and eligibility rules.');
  console.log('\n🎉 Database Seeding Complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
