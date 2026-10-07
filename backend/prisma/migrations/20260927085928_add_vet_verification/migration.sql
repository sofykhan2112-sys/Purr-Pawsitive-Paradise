/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `vet_listings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VetVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "vet_listings" ADD COLUMN     "userId" UUID,
ADD COLUMN     "verificationEvidenceReferences" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationReviewedById" UUID,
ADD COLUMN     "verificationStatus" "VetVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "vet_listings_userId_key" ON "vet_listings"("userId");

-- CreateIndex
CREATE INDEX "vet_listings_verificationStatus_idx" ON "vet_listings"("verificationStatus");

-- CreateIndex
CREATE INDEX "vet_listings_verificationReviewedById_idx" ON "vet_listings"("verificationReviewedById");

-- AddForeignKey
ALTER TABLE "vet_listings" ADD CONSTRAINT "vet_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_listings" ADD CONSTRAINT "vet_listings_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
