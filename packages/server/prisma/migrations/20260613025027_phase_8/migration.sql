-- AlterTable
ALTER TABLE "link_previews" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#818cf8',
    "position" INTEGER NOT NULL DEFAULT 0,
    "manage_channels" BOOLEAN NOT NULL DEFAULT false,
    "manage_roles" BOOLEAN NOT NULL DEFAULT false,
    "manage_members" BOOLEAN NOT NULL DEFAULT false,
    "kick_members" BOOLEAN NOT NULL DEFAULT false,
    "ban_members" BOOLEAN NOT NULL DEFAULT false,
    "delete_any_message" BOOLEAN NOT NULL DEFAULT false,
    "manage_webhooks" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_member_roles" (
    "member_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "workspace_member_roles_pkey" PRIMARY KEY ("member_id","role_id")
);

-- CreateIndex
CREATE INDEX "roles_workspace_id_position_idx" ON "roles"("workspace_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "roles_workspace_id_name_key" ON "roles"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_roles" ADD CONSTRAINT "workspace_member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "workspace_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_roles" ADD CONSTRAINT "workspace_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
