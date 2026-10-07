-- AlterTable
ALTER TABLE "vet_listings" ADD COLUMN     "availabilityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "availabilityVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "vet_availability_windows" (
    "id" UUID NOT NULL,
    "vetListingId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_availability_blocks" (
    "id" UUID NOT NULL,
    "vetListingId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vet_availability_windows_vetListingId_weekday_idx" ON "vet_availability_windows"("vetListingId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "vet_availability_windows_vetListingId_weekday_startMinute_e_key" ON "vet_availability_windows"("vetListingId", "weekday", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "vet_availability_blocks_vetListingId_startsAt_endsAt_idx" ON "vet_availability_blocks"("vetListingId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "vet_availability_windows" ADD CONSTRAINT "vet_availability_windows_vetListingId_fkey" FOREIGN KEY ("vetListingId") REFERENCES "vet_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_availability_blocks" ADD CONSTRAINT "vet_availability_blocks_vetListingId_fkey" FOREIGN KEY ("vetListingId") REFERENCES "vet_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
