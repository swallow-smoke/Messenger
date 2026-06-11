import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

loadRootEnv();

const prisma = new PrismaClient();

const DEV_EMAIL = 'dev@example.com';
const DEV_PASSWORD = 'password123';
const DEV_DISPLAY_NAME = 'Dev User';
const WORKSPACE_SLUG = 'dev-workspace';

function loadRootEnv(): void {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {
      passwordHash,
      displayName: DEV_DISPLAY_NAME,
    },
    create: {
      email: DEV_EMAIL,
      passwordHash,
      displayName: DEV_DISPLAY_NAME,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {
      name: 'Dev Workspace',
      ownerId: user.id,
    },
    create: {
      name: 'Dev Workspace',
      slug: WORKSPACE_SLUG,
      ownerId: user.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: 'owner',
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    },
  });

  const channel = await prisma.channel.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'general',
      },
    },
    update: {
      isArchived: false,
    },
    create: {
      workspaceId: workspace.id,
      createdBy: user.id,
      name: 'general',
      description: 'Default development channel',
    },
  });

  await prisma.channelMember.upsert({
    where: {
      channelId_userId: {
        channelId: channel.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      channelId: channel.id,
      userId: user.id,
    },
  });

  console.log(`Seeded dev login: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
