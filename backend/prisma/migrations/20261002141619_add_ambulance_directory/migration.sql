-- CreateEnum
CREATE TYPE "AmbulanceListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AmbulanceVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AmbulanceAvailability" AS ENUM ('UNKNOWN', 'AVAILABLE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "ambulance_listings" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "providerName" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "species" "Species"[] DEFAULT ARRAY[]::"Species"[],
    "animalRestrictions" VARCHAR(1000),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "websiteUrl" VARCHAR(2048),
    "openingHours" VARCHAR(1000),
    "timeZone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "AmbulanceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "availability" "AmbulanceAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "availabilityUpdatedAt" TIMESTAMPTZ(3),
    "requestsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID,
    "verificationStatus" "AmbulanceVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "verificationSubmittedAt" TIMESTAMPTZ(3),
    "verificationReviewedAt" TIMESTAMPTZ(3),
    "verificationReviewedById" UUID,
    "verificationNotes" TEXT,
    "verificationEvidenceReferences" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ambulance_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_service_areas" (
    "id" UUID NOT NULL,
    "ambulanceListingId" UUID NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "cityKey" VARCHAR(100) NOT NULL,
    "stateKey" VARCHAR(100) NOT NULL,

    CONSTRAINT "ambulance_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_listings_slug_key" ON "ambulance_listings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_listings_userId_key" ON "ambulance_listings"("userId");

-- CreateIndex
CREATE INDEX "ambulance_listings_status_city_state_idx" ON "ambulance_listings"("status", "city", "state");

-- CreateIndex
CREATE INDEX "ambulance_listings_verificationStatus_idx" ON "ambulance_listings"("verificationStatus");

-- CreateIndex
CREATE INDEX "ambulance_listings_verificationReviewedById_idx" ON "ambulance_listings"("verificationReviewedById");

-- CreateIndex
CREATE INDEX "ambulance_service_areas_countryCode_stateKey_cityKey_idx" ON "ambulance_service_areas"("countryCode", "stateKey", "cityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_service_areas_ambulanceListingId_countryCode_stat_key" ON "ambulance_service_areas"("ambulanceListingId", "countryCode", "stateKey", "cityKey");

-- AddForeignKey
ALTER TABLE "ambulance_listings" ADD CONSTRAINT "ambulance_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_listings" ADD CONSTRAINT "ambulance_listings_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_service_areas" ADD CONSTRAINT "ambulance_service_areas_ambulanceListingId_fkey" FOREIGN KEY ("ambulanceListingId") REFERENCES "ambulance_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
