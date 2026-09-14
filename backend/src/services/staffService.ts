import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

export async function getByOrganization(organizationId: string) {
  return prisma.staff.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(organizationId: string, data: any) {
  if (!organizationId) {
    throw appError('VALIDATION_ERROR', 'organizationId is required', 400);
  }
  return prisma.staff.create({
    data: {
      organizationId,
      branchId: data.branchId || null,
      name: data.name || '',
      role: data.role || 'staff',
      pin: data.pin || null,
      phone: data.phone || '',
      email: data.email || '',
      active: data.active !== false,
      metadata: data.metadata || {},
    },
  });
}

export async function update(id: string, data: any) {
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) {
    throw appError('STAFF_NOT_FOUND', 'Staff not found', 404);
  }

  return prisma.staff.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      role: data.role ?? existing.role,
      pin: data.pin !== undefined ? data.pin : existing.pin,
      phone: data.phone ?? existing.phone,
      email: data.email ?? existing.email,
      active: data.active !== undefined ? data.active : existing.active,
      metadata: data.metadata ?? existing.metadata,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) {
    throw appError('STAFF_NOT_FOUND', 'Staff not found', 404);
  }

  await prisma.staff.delete({ where: { id } });
  return { success: true };
}
