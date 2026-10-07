-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArticleTopic" AS ENUM ('BREEDS_AND_SPECIES', 'DAILY_CARE', 'NUTRITION', 'GROOMING', 'HABITAT', 'ENRICHMENT', 'PREVENTIVE_CARE', 'HEALTH', 'RAPID_RELIEF');

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "topic" "ArticleTopic" NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUrls" TEXT[],
    "requiresClinicalReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewerName" VARCHAR(150),
    "reviewerCredentials" VARCHAR(250),
    "reviewedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_species_topic_idx" ON "articles"("status", "species", "topic");
