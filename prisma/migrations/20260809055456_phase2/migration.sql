-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "dateOfBirth" DATETIME;

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recruitmentId" INTEGER NOT NULL,
    "allowedDegrees" TEXT,
    "allowedBranches" TEXT,
    "maxAge" INTEGER,
    "minAge" INTEGER,
    "experienceYears" INTEGER DEFAULT 0,
    "minPercentage" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EligibilityRule_recruitmentId_fkey" FOREIGN KEY ("recruitmentId") REFERENCES "Recruitment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recruitment" (
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
    "computedEligibility" TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "computedPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recruitment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recruitment" ("applicationEndDate", "applicationStartDate", "basicPay", "createdAt", "ctc", "description", "examDate", "grossSalary", "id", "notificationDate", "officialApplicationUrl", "officialNotificationUrl", "organizationId", "payLevel", "payScale", "postName", "recruitmentName", "status", "updatedAt", "vacancies", "verificationStatus") SELECT "applicationEndDate", "applicationStartDate", "basicPay", "createdAt", "ctc", "description", "examDate", "grossSalary", "id", "notificationDate", "officialApplicationUrl", "officialNotificationUrl", "organizationId", "payLevel", "payScale", "postName", "recruitmentName", "status", "updatedAt", "vacancies", "verificationStatus" FROM "Recruitment";
DROP TABLE "Recruitment";
ALTER TABLE "new_Recruitment" RENAME TO "Recruitment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityRule_recruitmentId_key" ON "EligibilityRule"("recruitmentId");
