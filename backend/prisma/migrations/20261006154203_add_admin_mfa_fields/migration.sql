-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecretCiphertext" TEXT,
ADD COLUMN     "mfaSecretIv" VARCHAR(64),
ADD COLUMN     "mfaSecretTag" VARCHAR(64),
ADD COLUMN     "mfaVerifiedAt" TIMESTAMPTZ(3);
