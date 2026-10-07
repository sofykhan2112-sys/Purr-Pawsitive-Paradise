-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'RESCHEDULE_PROPOSED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AppointmentReason" AS ENUM ('GENERAL_CHECKUP', 'PREVENTIVE_CARE', 'VACCINATION', 'FOLLOW_UP', 'HEALTH_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentContactPreference" AS ENUM ('EMAIL', 'PHONE');

-- AlterTable
ALTER TABLE "vet_listings" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeZone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "vetListingId" UUID NOT NULL,
    "providerUserId" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "reasonCategory" "AppointmentReason" NOT NULL,
    "reasonDetails" VARCHAR(1000),
    "contactPreference" "AppointmentContactPreference" NOT NULL,
    "contactEmail" VARCHAR(254),
    "contactPhone" VARCHAR(30),
    "requestedStartAt" TIMESTAMPTZ(3) NOT NULL,
    "requestedEndAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedStartAt" TIMESTAMPTZ(3),
    "confirmedEndAt" TIMESTAMPTZ(3),
    "proposedStartAt" TIMESTAMPTZ(3),
    "proposedEndAt" TIMESTAMPTZ(3),
    "timeZone" VARCHAR(100) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "responseDueAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_events" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "actorId" UUID,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "previousStatus" "AppointmentStatus",
    "newStatus" "AppointmentStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_ownerId_createdAt_idx" ON "appointments"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "appointments_providerUserId_status_requestedStartAt_idx" ON "appointments"("providerUserId", "status", "requestedStartAt");

-- CreateIndex
CREATE INDEX "appointments_vetListingId_status_confirmedStartAt_idx" ON "appointments"("vetListingId", "status", "confirmedStartAt");

-- CreateIndex
CREATE INDEX "appointments_petId_idx" ON "appointments"("petId");

-- CreateIndex
CREATE INDEX "appointments_status_responseDueAt_idx" ON "appointments"("status", "responseDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_ownerId_idempotencyKey_key" ON "appointments"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "appointment_events_appointmentId_createdAt_idx" ON "appointment_events"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "appointment_events_actorId_idx" ON "appointment_events"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_events_appointmentId_version_key" ON "appointment_events"("appointmentId", "version");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vetListingId_fkey" FOREIGN KEY ("vetListingId") REFERENCES "vet_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
