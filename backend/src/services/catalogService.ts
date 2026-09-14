import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

const CATALOG_TYPES = ['product', 'service', 'extra', 'combo', 'modifier'];

export async function getByOrganization(organizationId: string, type?: string, activeOnly?: boolean) {
  const where: any = { organizationId };
  if (type && CATALOG_TYPES.includes(type)) {
    where.type = type;
  }
  if (activeOnly) {
    where.active = true;
  }

  return prisma.catalogItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    throw appError('CATALOG_NOT_FOUND', 'Catalog item not found', 404);
  }
  return item;
}

export async function create(organizationId: string, data: any) {
  return prisma.catalogItem.create({
    data: {
      organizationId,
      branchId: data.branchId || null,
      type: CATALOG_TYPES.includes(data.type) ? data.type : 'product',
      name: data.name || '',
      description: data.description || '',
      categoryId: data.categoryId || null,
      price: Number(data.price) || 0,
      duration: data.duration != null ? Number(data.duration) : null,
      active: data.active !== false,
      metadata: data.metadata || {},
    },
  });
}

export async function update(id: string, data: any) {
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) {
    throw appError('CATALOG_NOT_FOUND', 'Catalog item not found', 404);
  }

  return prisma.catalogItem.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      type: data.type ?? existing.type,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.categoryId,
      price: data.price !== undefined ? Number(data.price) : existing.price,
      duration: data.duration !== undefined ? (data.duration != null ? Number(data.duration) : null) : existing.duration,
      active: data.active !== undefined ? data.active : existing.active,
      metadata: data.metadata ?? existing.metadata,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) {
    throw appError('CATALOG_NOT_FOUND', 'Catalog item not found', 404);
  }

  await prisma.catalogItem.delete({ where: { id } });
  return { success: true };
}
