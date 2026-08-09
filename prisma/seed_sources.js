const prisma = require('../src/lib/prisma.js');

async function main() {
  console.log('Seeding Scraper Sources...');
  
  const sources = [
    // GOVERNMENT
    { name: 'SSC', category: 'GOVERNMENT', adapterName: 'sscAdapter' },
    { name: 'UPSC', category: 'GOVERNMENT', adapterName: 'upscAdapter' },
    { name: 'RRB', category: 'GOVERNMENT', adapterName: 'rrbAdapter' },
    { name: 'TNPSC', category: 'GOVERNMENT', adapterName: 'tnpscAdapter' },
    { name: 'ISRO', category: 'GOVERNMENT', adapterName: 'isroAdapter' },
    { name: 'DRDO', category: 'GOVERNMENT', adapterName: 'drdoAdapter' },
    { name: 'NIC', category: 'GOVERNMENT', adapterName: 'nicAdapter' },
    { name: 'NIELIT', category: 'GOVERNMENT', adapterName: 'nielitAdapter' },
    
    // BANKING
    { name: 'IBPS', category: 'BANKING', adapterName: 'ibpsMockAdapter' },
    { name: 'SBI', category: 'BANKING', adapterName: 'sbiAdapter' },
    { name: 'RBI', category: 'BANKING', adapterName: 'rbiAdapter' },
    { name: 'NABARD', category: 'BANKING', adapterName: 'nabardAdapter' },
    
    // PSU
    { name: 'BEL', category: 'PSU', adapterName: 'belAdapter' },
    { name: 'BHEL', category: 'PSU', adapterName: 'bhelAdapter' },
    { name: 'HAL', category: 'PSU', adapterName: 'halAdapter' },
    { name: 'ONGC', category: 'PSU', adapterName: 'ongcAdapter' },
    { name: 'NTPC', category: 'PSU', adapterName: 'ntpcAdapter' },
    { name: 'IOCL', category: 'PSU', adapterName: 'ioclAdapter' },
    { name: 'GAIL', category: 'PSU', adapterName: 'gailAdapter' },
    { name: 'Power Grid', category: 'PSU', adapterName: 'powerGridAdapter' },
    
    // PRIVATE IT
    { name: 'TCS', category: 'PRIVATE_IT', adapterName: 'tcsAdapter' },
    { name: 'Infosys', category: 'PRIVATE_IT', adapterName: 'infosysAdapter' },
    { name: 'Zoho', category: 'PRIVATE_IT', adapterName: 'zohoAdapter' },
    { name: 'Freshworks', category: 'PRIVATE_IT', adapterName: 'freshworksAdapter' },
    { name: 'Accenture', category: 'PRIVATE_IT', adapterName: 'accentureAdapter' },
    { name: 'Wipro', category: 'PRIVATE_IT', adapterName: 'wiproAdapter' },
    { name: 'HCLTech', category: 'PRIVATE_IT', adapterName: 'hcltechAdapter' },
    { name: 'Cognizant', category: 'PRIVATE_IT', adapterName: 'cognizantAdapter' },
    { name: 'Microsoft', category: 'PRIVATE_IT', adapterName: 'microsoftAdapter' },
    { name: 'Amazon', category: 'PRIVATE_IT', adapterName: 'amazonAdapter' },
    { name: 'Google', category: 'PRIVATE_IT', adapterName: 'googleAdapter' },
    { name: 'LTIMindtree', category: 'PRIVATE_IT', adapterName: 'ltimindtreeAdapter' },
    { name: 'IBM', category: 'PRIVATE_IT', adapterName: 'ibmAdapter' },
    { name: 'Oracle', category: 'PRIVATE_IT', adapterName: 'oracleAdapter' },
    { name: 'Capgemini', category: 'PRIVATE_IT', adapterName: 'capgeminiAdapter' },
  ];

  for (const src of sources) {
    await prisma.scraperSource.upsert({
      where: { name: src.name },
      update: {},
      create: {
        name: src.name,
        category: src.category,
        adapterName: src.adapterName,
        status: 'ACTIVE',
        lastCheckedAt: new Date(),
        lastSuccessfulFetchAt: src.name === 'IBPS' ? new Date() : null, // IBPS is the only one we know works
      }
    });
  }

  console.log('Seed sources completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
