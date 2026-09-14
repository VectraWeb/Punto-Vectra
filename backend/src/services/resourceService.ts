import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

export async function getByOrganization(organizationId: string, type?: string) {
  const where: any = { organizationId };
  if (type) where.type = type;

  return prisma.resource.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

export async function getById(organizationId: string, id: string) {
  const resource = await prisma.resource.findFirst({
    where: { organizationId, id },
  });
  if (!resource) {
    throw appError('RESOURCE_NOT_FOUND', 'Resource not found', 404);
  }
  return resource;
}

export async function create(organizationId: string, data: any) {
  return prisma.resource.create({
    data: {
      organizationId,
      branchId: data.branchId || null,
      name: data.name || 'Recurso',
      type: data.type || 'table',
      capacity: data.capacity || 0,
      status: data.status || 'active',
      position: data.position || null,
      width: data.width || 0,
      height: data.height || 0,
      shape: data.shape || 'rectangular',
      metadata: data.metadata || {},
      generated: data.generated || false,
    },
  });
}

export async function update(organizationId: string, id: string, data: any) {
  const existing = await prisma.resource.findFirst({
    where: { organizationId, id },
  });
  if (!existing) {
    throw appError('RESOURCE_NOT_FOUND', 'Resource not found', 404);
  }

  return prisma.resource.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      type: data.type ?? existing.type,
      capacity: data.capacity ?? existing.capacity,
      status: data.status ?? existing.status,
      position: data.position ?? existing.position,
      width: data.width ?? existing.width,
      height: data.height ?? existing.height,
      shape: data.shape ?? existing.shape,
      metadata: data.metadata ?? existing.metadata,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
    },
  });
}

export async function remove(organizationId: string, id: string) {
  const existing = await prisma.resource.findFirst({
    where: { organizationId, id },
  });
  if (!existing) {
    throw appError('RESOURCE_NOT_FOUND', 'Resource not found', 404);
  }

  await prisma.resource.delete({ where: { id } });
  return { success: true };
}

export async function seed(organizationId: string, resources: any[]) {
  const created = [];
  for (const resource of resources) {
    const existing = await prisma.resource.findFirst({
      where: {
        organizationId,
        name: resource.name,
        generated: true,
      },
    });

    if (!existing) {
      const r = await prisma.resource.create({
        data: {
          organizationId,
          branchId: resource.branchId || null,
          name: resource.name,
          type: resource.type || 'table',
          capacity: resource.capacity || 0,
          status: resource.status || 'active',
          position: resource.position || null,
          width: resource.width || 0,
          height: resource.height || 0,
          shape: resource.shape || 'rectangular',
          number: resource.number ?? null,
          metadata: resource.metadata || {},
          generated: resource.generated !== false,
        },
      });
      created.push(r);
    }
  }
  return created;
}
