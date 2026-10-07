-- CreateEnum
CREATE TYPE "IssueReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IssueReportCategory" AS ENUM ('INCORRECT_INFORMATION', 'OUTDATED_INFORMATION', 'SAFETY_CONCERN', 'CONTACT_DETAILS', 'OTHER');

-- CreateTable
CREATE TABLE "issue_reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "articleId" UUID,
    "vetListingId" UUID,
    "ambulanceListingId" UUID,
    "targetLabel" VARCHAR(250) NOT NULL,
    "category" "IssueReportCategory" NOT NULL,
    "details" VARCHAR(2000) NOT NULL,
    "status" "IssueReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionSummary" VARCHAR(1000),
    "closedAt" TIMESTAMPTZ(3),
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_report_events" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "actorId" UUID,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "previousStatus" "IssueReportStatus",
    "newStatus" "IssueReportStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_report_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_reports_reporterId_createdAt_idx" ON "issue_reports"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "issue_reports_status_createdAt_idx" ON "issue_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "issue_reports_category_status_createdAt_idx" ON "issue_reports"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "issue_reports_articleId_idx" ON "issue_reports"("articleId");

-- CreateIndex
CREATE INDEX "issue_reports_vetListingId_idx" ON "issue_reports"("vetListingId");

-- CreateIndex
CREATE INDEX "issue_reports_ambulanceListingId_idx" ON "issue_reports"("ambulanceListingId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_reports_reporterId_idempotencyKey_key" ON "issue_reports"("reporterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "issue_report_events_reportId_createdAt_idx" ON "issue_report_events"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "issue_report_events_actorId_idx" ON "issue_report_events"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_report_events_reportId_version_key" ON "issue_report_events"("reportId", "version");

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_vetListingId_fkey" FOREIGN KEY ("vetListingId") REFERENCES "vet_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_ambulanceListingId_fkey" FOREIGN KEY ("ambulanceListingId") REFERENCES "ambulance_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_report_events" ADD CONSTRAINT "issue_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "issue_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_report_events" ADD CONSTRAINT "issue_report_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issue_reports"
ADD CONSTRAINT "issue_reports_exactly_one_target"
CHECK (
  num_nonnulls(
    "articleId",
    "vetListingId",
    "ambulanceListingId"
  ) = 1
);