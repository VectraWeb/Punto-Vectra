import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'expired'],
  checked_in: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

function canTransition(from: string, to: string): boolean {
  return (RESERVATION_TRANSITIONS[from] || []).includes(to);
}

function t2m(time: string, service?: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  let minutes = h * 60 + m;

  if (service === 'cena' && h < 12) {
    minutes += 24 * 60;
  }

  return minutes;
}

function reservationsOverlap(a: any, b: any): boolean {
  if (a.id && b.id && a.id === b.id) return false;
  if (a.resourceId !== b.resourceId) return false;
  if (a.date !== b.date) return false;
  if (a.service && b.service && a.service !== b.service) return false;

  const aStart = t2m(a.time, a.service);
  const aEnd = aStart + (Number(a.duration) || 0);
  const bStart = t2m(b.time, b.service);
  const bEnd = bStart + (Number(b.duration) || 0);

  if (a.duration === 0 && b.duration === 0) {
    return a.time === b.time;
  }

  return aStart < bEnd && aEnd > bStart;
}

export async function getAll(params: { organizationId?: string; date?: string; service?: string }) {
  const where: any = {};
  if (params.organizationId) where.organizationId = params.organizationId;
  if (params.date) where.date = params.date;
  if (params.service) where.service = params.service;

  return prisma.reservation.findMany({
    where,
    include: { resource: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { resource: true },
  });
  if (!reservation) {
    throw appError('RESERVATION_NOT_FOUND', 'Reservation not found', 404);
  }
  return reservation;
}

export async function create(data: any) {
  if (data.idempotencyKey) {
    const existing = await prisma.reservation.findFirst({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existing) return existing;
  }

  const resourceId = data.resourceId || data.tableId || data.mesa_id || null;

  const organizationId = data.organizationId;
  const date = data.date;
  const time = data.time;
  const service = data.service || '';
  const duration = Number(data.duration) || 0;

  if (!organizationId) {
    throw appError('VALIDATION_ERROR', 'organizationId is required', 400);
  }

  let resourceBranchId = data.branchId;

  if (resourceId) {
    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) {
      throw appError('RESOURCE_NOT_FOUND', 'Resource not found', 404);
    }
    if (!date || !time) {
      throw appError('VALIDATION_ERROR', 'date and time are required', 400);
    }

    const existingReservations = await prisma.reservation.findMany({
      where: {
        resourceId,
        date,
        status: { notIn: ['cancelled', 'no_show', 'expired'] },
      },
    });

    const candidate = {
      id: null,
      resourceId,
      date,
      time,
      service,
      duration,
    };

    for (const existing of existingReservations) {
      if (reservationsOverlap(candidate, existing)) {
        throw appError('RESERVATION_CONFLICT', 'Time slot is not available', 409);
      }
    }

    resourceBranchId = resource.branchId;
  }

  const guests = data.guests || data.partySize || 1;

  const reservation = await prisma.reservation.create({
    data: {
      organizationId,
      branchId: data.branchId || resourceBranchId || 'main',
      resourceId,
      resourceLabel: data.resourceLabel || '',
      resourceName: data.resourceName || '',
      customerId: data.customerId || null,
      customerName: data.customerName || '',
      phone: data.phone || '',
      email: data.email || '',
      date: date || '',
      time: time || '',
      service,
      duration: duration || null,
      partySize: data.partySize || null,
      status: 'pending',
      guests,
      notes: data.notes || '',
      source: data.source || 'web',
      metadata: data.metadata || {},
      idempotencyKey: data.idempotencyKey || null,
      estado: data.estado || 'pendiente',
      staffId: data.staffId || null,
      staffName: data.staffName || '',
      mesa: data.mesa || '',
      mesaId: data.mesa_id || data.mesaId || null,
      plates: data.plates || [],
      liveState: data.liveState || null,
    },
    include: { resource: true },
  });

  if (resourceId) {
    await createResourceLock(reservation, duration);
  }

  return reservation;
}

export async function update(id: string, data: any) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) {
    throw appError('RESERVATION_NOT_FOUND', 'Reservation not found', 404);
  }

  const resourceId = data.resourceId || data.tableId || existing.resourceId;
  const patch: any = {
    customerName: data.customerName ?? existing.customerName,
    phone: data.phone ?? existing.phone,
    email: data.email ?? existing.email,
    guests: data.guests ?? existing.guests,
    partySize: data.partySize ?? existing.partySize,
    notes: data.notes ?? existing.notes,
    metadata: data.metadata ?? existing.metadata,
    resourceId: resourceId,
    mesa: data.mesa ?? existing.mesa,
    mesaId: data.mesa_id ?? data.mesaId ?? existing.mesaId,
    staffId: data.staffId ?? existing.staffId,
    staffName: data.staffName ?? existing.staffName,
    time: data.time ?? existing.time,
    service: data.service ?? existing.service,
    duration: data.duration ?? existing.duration,
    date: data.date ?? existing.date,
    plates: data.plates ?? existing.plates,
  };

  if (data.status) patch.status = data.status;
  if (data.estado) patch.estado = data.estado;
  if (data.liveState !== undefined) patch.liveState = data.liveState;
  if (data.stateLog) patch.stateLog = data.stateLog;
  if (data.startedAt !== undefined) patch.startedAt = data.startedAt ? new Date(data.startedAt) : null;
  if (data.leftAt !== undefined) patch.leftAt = data.leftAt ? new Date(data.leftAt) : null;
  if (data.cleaningStartedAt !== undefined) patch.cleaningStartedAt = data.cleaningStartedAt ? new Date(data.cleaningStartedAt) : null;

  return prisma.reservation.update({
    where: { id },
    data: patch,
    include: { resource: true },
  });
}

export async function updateStatus(id: string, status: string, estado?: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    throw appError('RESERVATION_NOT_FOUND', 'Reservation not found', 404);
  }

  let targetStatus = status;
  if (estado) {
    const legacyMap: Record<string, string> = {
      pendiente: 'pending',
      confirmada: 'confirmed',
      cancelado: 'cancelled',
      no_show: 'no_show',
    };
    targetStatus = legacyMap[estado] || status;
  }

  if (!canTransition(reservation.status, targetStatus)) {
    throw appError(
      'INVALID_STATUS_TRANSITION',
      `Invalid transition: ${reservation.status} -> ${targetStatus}`,
      400
    );
  }

  const statusToEstado: Record<string, string> = {
    pending: 'pendiente',
    confirmed: 'confirmada',
    cancelled: 'cancelado',
    no_show: 'no_show',
    completed: 'finalizado',
    expired: 'expirado',
  };

  const updateData: any = { status: targetStatus };
  if (statusToEstado[targetStatus]) {
    updateData.estado = statusToEstado[targetStatus];
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: updateData,
    include: { resource: true },
  });

  if (['cancelled', 'completed', 'expired', 'no_show'].includes(targetStatus)) {
    await removeResourceLock(reservation);
  }

  return updated;
}

export async function cancel(id: string, motivo?: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    throw appError('RESERVATION_NOT_FOUND', 'Reservation not found', 404);
  }
  if (reservation.status === 'cancelled') {
    return reservation;
  }
  return updateStatus(id, 'cancelled');
}

export async function remove(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    throw appError('RESERVATION_NOT_FOUND', 'Reservation not found', 404);
  }
  await removeResourceLock(reservation);
  return prisma.reservation.delete({ where: { id } });
}

export async function checkAvailability(data: any) {
  const { resourceId, date, service, time, duration } = data;
  if (!resourceId || !date) {
    throw appError('VALIDATION_ERROR', 'resourceId and date are required', 400);
  }

  const existingReservations = await prisma.reservation.findMany({
    where: {
      resourceId,
      date,
      status: { notIn: ['cancelled', 'no_show', 'expired'] },
    },
  });

  const candidate = {
    id: null,
    resourceId,
    date,
    time: time || '00:00',
    service: service || '',
    duration: Number(duration) || 60,
  };

  const conflicts = existingReservations.filter((r) => reservationsOverlap(candidate, r));

  return {
    available: conflicts.length === 0,
    conflicts: conflicts.length,
  };
}

export async function getAnalytics(organizationId: string, dates: string[]) {
  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      date: { in: dates },
    },
    include: { resource: true },
  });

  const byDate: Record<string, any[]> = {};
  for (const date of dates) {
    byDate[date] = reservations.filter((r) => r.date === date);
  }

  return {
    total: reservations.length,
    byDate,
    byStatus: {
      pending: reservations.filter((r) => r.status === 'pending').length,
      confirmed: reservations.filter((r) => r.status === 'confirmed').length,
      checked_in: reservations.filter((r) => r.status === 'checked_in').length,
      in_progress: reservations.filter((r) => r.status === 'in_progress').length,
      completed: reservations.filter((r) => r.status === 'completed').length,
      cancelled: reservations.filter((r) => r.status === 'cancelled').length,
      no_show: reservations.filter((r) => r.status === 'no_show').length,
      expired: reservations.filter((r) => r.status === 'expired').length,
    },
  };
}

async function createResourceLock(reservation: any, duration: number) {
  if (duration <= 0) return;

  const startMinutes = t2m(reservation.time, reservation.service);
  const endMinutes = startMinutes + duration;

  await prisma.resourceLock.create({
    data: {
      resourceId: reservation.resourceId,
      date: reservation.date,
      service: reservation.service || '',
      startTime: startMinutes,
      endTime: endMinutes,
      reservationId: reservation.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
}

async function removeResourceLock(reservation: any) {
  await prisma.resourceLock.deleteMany({
    where: { reservationId: reservation.id },
  });
}
