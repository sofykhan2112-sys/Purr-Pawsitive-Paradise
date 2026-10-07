-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[];
