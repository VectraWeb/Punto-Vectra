import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

export async function getByOrganization(organizationId: string) {
  return prisma.branch.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function create(organizationId: string, data: any) {
  const existing = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!existing) {
    throw appError('ORG_NOT_FOUND', 'Organization not found', 404);
  }

  if (data.id) {
    const branchExists = await prisma.branch.findUnique({
      where: { organizationId_id: { organizationId, id: data.id } },
    });
    if (branchExists) {
      throw appError('BRANCH_EXISTS', 'Branch already exists', 409);
    }
  }

  return prisma.branch.create({
    data: {
      id: data.id || `branch_${Date.now()}`,
      organizationId,
      name: data.name || 'Sucursal',
      address: data.address || {},
      timezone: data.timezone || 'America/Argentina/Buenos_Aires',
      businessHours: data.businessHours || {},
      settings: data.settings || {},
    },
  });
}

export async function remove(organizationId: string, branchId: string) {
  if (branchId === 'main') {
    throw appError('CANNOT_DELETE_MAIN', 'Cannot delete main branch', 400);
  }

  const branch = await prisma.branch.findUnique({
    where: { organizationId_id: { organizationId, id: branchId } },
  });
  if (!branch) {
    throw appError('BRANCH_NOT_FOUND', 'Branch not found', 404);
  }

  await prisma.branch.delete({
    where: { organizationId_id: { organizationId, id: branchId } },
  });

  return { success: true };
}
