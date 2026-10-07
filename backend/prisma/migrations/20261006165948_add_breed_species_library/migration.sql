-- CreateTable
CREATE TABLE "breed_species_records" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "petGroup" "Species" NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "characteristics" TEXT NOT NULL,
    "careSummary" TEXT NOT NULL,
    "articleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "breed_species_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "breed_species_records_slug_key" ON "breed_species_records"("slug");

-- CreateIndex
CREATE INDEX "breed_species_records_petGroup_name_idx" ON "breed_species_records"("petGroup", "name");
