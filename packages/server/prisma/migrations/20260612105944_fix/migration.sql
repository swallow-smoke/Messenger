-- AlterTable
ALTER TABLE "link_previews" ADD COLUMN     "embed_url" TEXT,
ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';
