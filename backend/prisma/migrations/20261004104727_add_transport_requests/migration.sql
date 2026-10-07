-- CreateEnum
CREATE TYPE "TransportRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "transport_requests" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "ambulanceListingId" UUID NOT NULL,
    "providerUserId" UUID NOT NULL,
    "status" "TransportRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "petName" VARCHAR(100) NOT NULL,
    "petSpecies" "Species" NOT NULL,
    "pickupAddress" VARCHAR(500) NOT NULL,
    "pickupCity" VARCHAR(100) NOT NULL,
    "pickupState" VARCHAR(100) NOT NULL,
    "pickupCountryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "pickupPostalCode" VARCHAR(20),
    "destinationAddress" VARCHAR(500) NOT NULL,
    "destinationCity" VARCHAR(100) NOT NULL,
    "destinationState" VARCHAR(100) NOT NULL,
    "destinationCountryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "destinationPostalCode" VARCHAR(20),
    "contactName" VARCHAR(100) NOT NULL,
    "contactPhone" VARCHAR(30) NOT NULL,
    "notes" VARCHAR(1000),
    "requestedPickupAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedPickupAt" TIMESTAMPTZ(3),
    "timeZone" VARCHAR(100) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "responseDueAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transport_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_request_events" (
    "id" UUID NOT NULL,
    "transportRequestId" UUID NOT NULL,
    "actorId" UUID,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "previousStatus" "TransportRequestStatus",
    "newStatus" "TransportRequestStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_requests_ownerId_createdAt_idx" ON "transport_requests"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "transport_requests_providerUserId_status_requestedPickupAt_idx" ON "transport_requests"("providerUserId", "status", "requestedPickupAt");

-- CreateIndex
CREATE INDEX "transport_requests_ambulanceListingId_status_requestedPicku_idx" ON "transport_requests"("ambulanceListingId", "status", "requestedPickupAt");

-- CreateIndex
CREATE INDEX "transport_requests_petId_idx" ON "transport_requests"("petId");

-- CreateIndex
CREATE INDEX "transport_requests_status_responseDueAt_idx" ON "transport_requests"("status", "responseDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "transport_requests_ownerId_idempotencyKey_key" ON "transport_requests"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "transport_request_events_transportRequestId_createdAt_idx" ON "transport_request_events"("transportRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "transport_request_events_actorId_idx" ON "transport_request_events"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_request_events_transportRequestId_version_key" ON "transport_request_events"("transportRequestId", "version");

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_ambulanceListingId_fkey" FOREIGN KEY ("ambulanceListingId") REFERENCES "ambulance_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_request_events" ADD CONSTRAINT "transport_request_events_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "transport_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_request_events" ADD CONSTRAINT "transport_request_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
