import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

function normalizePhoneKey(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

export async function getByOrganization(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    throw appError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }
  return customer;
}

export async function getOrCreate(data: {
  organizationId: string;
  branchId?: string;
  phone: string;
  name?: string;
  email?: string;
}) {
  if (!data.phone) {
    throw appError('VALIDATION_ERROR', 'Phone is required', 400);
  }

  const normalizedPhone = normalizePhoneKey(data.phone);

  let customer = await prisma.customer.findFirst({
    where: {
      organizationId: data.organizationId,
      phone: normalizedPhone,
    },
  });

  if (customer) {
    const updates: any = {};
    if (data.name && !customer.name) updates.name = data.name;
    if (data.email && !customer.email) updates.email = data.email;
    if (data.branchId && !customer.branchId) updates.branchId = data.branchId;

    if (Object.keys(updates).length > 0) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: updates,
      });
    }
    return customer;
  }

  customer = await prisma.customer.create({
    data: {
      organizationId: data.organizationId,
      branchId: data.branchId || null,
      name: data.name || '',
      phone: normalizedPhone,
      email: data.email || '',
      stats: {
        reservations: 0,
        completedReservations: 0,
        cancellations: 0,
        noShows: 0,
        totalSpent: 0,
      },
    },
  });

  return customer;
}

export async function update(id: string, data: any) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw appError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  return prisma.customer.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      phone: data.phone ?? existing.phone,
      email: data.email ?? existing.email,
      contact: data.contact ?? existing.contact,
      tags: data.tags ?? existing.tags,
      notes: data.notes ?? existing.notes,
      preferences: data.preferences ?? existing.preferences,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw appError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  await prisma.customer.delete({ where: { id } });
  return { success: true };
}
