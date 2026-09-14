import { prisma } from '../index';

export async function getByOrganization(organizationId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

export async function create(data: {
  organizationId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: any;
  after?: any;
  metadata?: any;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId || null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || null,
      before: data.before || null,
      after: data.after || null,
      metadata: data.metadata || {},
    },
  });
}
