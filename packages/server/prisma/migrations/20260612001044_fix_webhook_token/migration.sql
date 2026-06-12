-- AlterTable
ALTER TABLE "link_previews" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';
