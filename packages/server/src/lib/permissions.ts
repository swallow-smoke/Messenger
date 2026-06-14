import { prisma } from './prisma';

export type Permission =
  | 'manageChannels'
  | 'manageRoles'
  | 'manageMembers'
  | 'kickMembers'
  | 'banMembers'
  | 'deleteAnyMessage'
  | 'manageWebhooks';

export async function hasPermission(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<boolean> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: {
      assignedRoles: {
        include: { role: true },
      },
    },
  });

  if (!member) return false;
  // owner and admin always pass (legacy fallback until role migration)
  if (member.role === 'owner' || member.role === 'admin') return true;
  return member.assignedRoles.some((mr) => mr.role[permission] === true);
}
