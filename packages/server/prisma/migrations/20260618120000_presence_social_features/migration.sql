-- CreateEnum
CREATE TYPE "connected_account_provider" AS ENUM ('github', 'notion', 'itchio', 'portfolio');

-- CreateEnum
CREATE TYPE "social_badge_type" AS ENUM ('helpful', 'great_review', 'team_player', 'creative', 'mentor');

-- AlterTable
ALTER TABLE "link_previews" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "custom_typing_text" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_readme" TEXT,
ADD COLUMN     "profile_view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "connected_account_provider" NOT NULL,
    "url" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "day_of_week" INTEGER,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "status_emoji" TEXT,
    "status_text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "social_badge_type" NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_idx" ON "connected_accounts"("user_id");

-- CreateIndex
CREATE INDEX "status_schedules_user_id_idx" ON "status_schedules"("user_id");

-- CreateIndex
CREATE INDEX "social_badges_to_user_id_created_at_idx" ON "social_badges"("to_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_badges_from_user_id_to_user_id_created_at_idx" ON "social_badges"("from_user_id", "to_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_schedules" ADD CONSTRAINT "status_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_badges" ADD CONSTRAINT "social_badges_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_badges" ADD CONSTRAINT "social_badges_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_badges" ADD CONSTRAINT "social_badges_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
