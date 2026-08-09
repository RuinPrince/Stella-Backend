-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "education" TEXT,
    "graduationYear" INTEGER,
    "country" TEXT,
    "state" TEXT,
    "primaryInterests" TEXT,
    "salaryPreference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "officialUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recruitment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" INTEGER NOT NULL,
    "recruitmentName" TEXT NOT NULL,
    "postName" TEXT NOT NULL,
    "vacancies" INTEGER,
    "description" TEXT,
    "basicPay" TEXT,
    "payLevel" TEXT,
    "payScale" TEXT,
    "grossSalary" TEXT,
    "ctc" TEXT,
    "applicationStartDate" DATETIME,
    "applicationEndDate" DATETIME,
    "examDate" DATETIME,
    "notificationDate" DATETIME,
    "officialNotificationUrl" TEXT,
    "officialApplicationUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "verificationStatus" TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recruitment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
