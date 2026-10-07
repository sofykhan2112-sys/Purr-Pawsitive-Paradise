-- CreateEnum
CREATE TYPE "VetListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "vet_listings" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "vetName" VARCHAR(150) NOT NULL,
    "clinicName" VARCHAR(180) NOT NULL,
    "qualifications" VARCHAR(250),
    "registrationNumber" VARCHAR(100),
    "registrationBody" VARCHAR(180),
    "description" TEXT,
    "species" "Species"[] DEFAULT ARRAY[]::"Species"[],
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postalCode" VARCHAR(20),
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "websiteUrl" VARCHAR(2048),
    "openingHours" VARCHAR(1000),
    "status" "VetListingStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "lastConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vet_listings_slug_key" ON "vet_listings"("slug");

-- CreateIndex
CREATE INDEX "vet_listings_status_city_idx" ON "vet_listings"("status", "city");

-- CreateIndex
CREATE INDEX "vet_listings_status_state_idx" ON "vet_listings"("status", "state");
