-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "rules" TEXT;

-- AlterTable
ALTER TABLE "link_previews" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- CreateTable
CREATE TABLE "channel_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_categories_workspace_id_idx" ON "channel_categories"("workspace_id");

-- CreateIndex
CREATE INDEX "channels_category_id_idx" ON "channels"("category_id");

-- AddForeignKey
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "channel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
