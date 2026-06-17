-- AlterTable
ALTER TABLE "link_previews" ADD COLUMN     "data" JSONB,
ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';
