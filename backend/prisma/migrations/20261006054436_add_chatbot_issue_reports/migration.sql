-- AlterTable
ALTER TABLE "issue_reports" ADD COLUMN     "chatbotMode" VARCHAR(50),
ADD COLUMN     "chatbotQuestion" VARCHAR(500),
ADD COLUMN     "chatbotResponse" VARCHAR(2000),
ADD COLUMN     "chatbotResponseId" UUID;

-- CreateIndex
CREATE INDEX "issue_reports_chatbotResponseId_idx" ON "issue_reports"("chatbotResponseId");