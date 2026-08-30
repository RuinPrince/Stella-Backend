-- Adds user ownership and application follow-up/history without deleting
-- existing opportunities or legacy application records.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "percentage" DOUBLE PRECISION;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile"("userId");

DROP INDEX IF EXISTS "ApplicationTracker_recruitmentId_key";
ALTER TABLE "ApplicationTracker" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "ApplicationTracker" ADD COLUMN IF NOT EXISTS "followUpDate" TIMESTAMP(3);
ALTER TABLE "ApplicationTracker" ADD COLUMN IF NOT EXISTS "stageHistory" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ApplicationTracker" ADD COLUMN IF NOT EXISTS "applicationUrl" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationTracker_userId_recruitmentId_key" ON "ApplicationTracker"("userId", "recruitmentId");
