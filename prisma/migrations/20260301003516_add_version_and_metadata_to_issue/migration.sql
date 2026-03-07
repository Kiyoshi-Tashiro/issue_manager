-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
