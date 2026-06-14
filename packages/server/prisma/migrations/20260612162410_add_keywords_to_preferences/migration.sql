-- AlterTable
ALTER TABLE "link_previews" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
