import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

export async function getAll() {
  return prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (org) return org;

  throw appError('ORG_NOT_FOUND', 'Organization not found', 404);
}

export async function create(data: any) {
  return prisma.organization.create({
    data: {
      id: data.id || `org_${Date.now()}`,
      name: data.name || 'Mi Negocio',
      businessType: data.businessType || 'restaurant',
      logo: data.logo || '',
      ownerUid: data.ownerUid || null,
      configuration: data.configuration || {},
      bookingFields: data.bookingFields || [],
      closedDates: data.closedDates || [],
    },
  });
}

export async function update(id: string, data: any) {
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    throw appError('ORG_NOT_FOUND', 'Organization not found', 404);
  }

  return prisma.organization.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      businessType: data.businessType ?? existing.businessType,
      logo: data.logo ?? existing.logo,
      ownerUid: data.ownerUid ?? existing.ownerUid,
      configuration: data.configuration ?? existing.configuration,
      bookingFields: data.bookingFields ?? existing.bookingFields,
      closedDates: data.closedDates ?? existing.closedDates,
    },
  });
}

export async function patch(id: string, data: any) {
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    throw appError('ORG_NOT_FOUND', 'Organization not found', 404);
  }

  const config = existing.configuration as any;
  const newConfig = data.configuration ? { ...config, ...data.configuration } : config;

  return prisma.organization.update({
    where: { id },
    data: {
      ...data,
      configuration: newConfig,
    },
  });
}
