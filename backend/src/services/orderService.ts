import { prisma } from '../index';
import { appError } from '../middleware/errorHandler';

const ORDER_TRANSITIONS: Record<string, string[]> = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['in_preparation', 'cancelled'],
  in_preparation: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function canTransition(from: string, to: string): boolean {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

export async function getAll(params: { organizationId?: string; date?: string; service?: string }) {
  const where: any = {};
  if (params.organizationId) where.organizationId = params.organizationId;
  if (params.date) where.date = params.date;
  if (params.service) where.service = params.service;

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw appError('ORDER_NOT_FOUND', 'Order not found', 404);
  }
  return order;
}

export async function create(data: any) {
  const items = Array.isArray(data.items) ? data.items : [];

  const computedSubtotal = items.reduce((sum: number, item: any) => {
    const quantity = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    return sum + (Number(item.subtotal) || quantity * unitPrice);
  }, 0);

  const totals = data.totals || {};
  const total = totals.total ?? computedSubtotal;

  return prisma.order.create({
    data: {
      organizationId: data.organizationId,
      branchId: data.branchId || 'main',
      customerId: data.customerId || null,
      customerName: data.customerName || '',
      phone: data.phone || '',
      reservationId: data.reservationId || null,
      resourceId: data.resourceId || null,
      status: 'created',
      items: items,
      totals: {
        subtotal: totals.subtotal ?? computedSubtotal,
        discounts: totals.discounts ?? 0,
        taxes: totals.taxes ?? 0,
        total,
      },
      modalidad: data.modalidad || null,
      direccion: data.direccion || '',
      notes: data.notes || '',
      date: data.date || '',
      service: data.service || '',
      source: data.source || 'web',
      metadata: data.metadata || {},
    },
  });
}

export async function update(id: string, data: any) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw appError('ORDER_NOT_FOUND', 'Order not found', 404);
  }

  const payload: any = {};

  const knownFields: Record<string, string> = {
    customerName: 'customerName',
    phone: 'phone',
    customerPhone: 'customerPhone',
    items: 'items',
    totals: 'totals',
    notes: 'notes',
    direccion: 'direccion',
    modalidad: 'modalidad',
    pedidoRechazoMotivo: 'pedidoRechazoMotivo',
    tiempoPreparacionMin: 'tiempoPreparacionMin',
    tiempoEnvioMin: 'tiempoEnvioMin',
    tiempoTotalMin: 'tiempoTotalMin',
    metadata: 'metadata',
  };

  for (const [key, column] of Object.entries(knownFields)) {
    if (data[key] !== undefined) payload[column] = data[key];
  }

  // Timestamps tipo serverTimestamp (ya resueltos a ISO string por el shim).
  if (data.confirmadoAt) {
    payload.confirmadoAt = data.confirmadoAt instanceof Date
      ? data.confirmadoAt
      : new Date(data.confirmadoAt);
  }

  if (data.pedidoEstado !== undefined || data.status !== undefined) {
    let pedidoEstado = data.pedidoEstado ?? order.pedidoEstado;
    let targetStatus = order.status;

    if (data.pedidoEstado !== undefined) {
      const legacyMap: Record<string, string> = {
        pendiente: 'created',
        confirmado: 'confirmed',
        en_preparacion: 'in_preparation',
        listo: 'ready',
        entregado: 'completed',
        finalizado: 'completed',
        cancelado: 'cancelled',
      };
      targetStatus = legacyMap[pedidoEstado] || order.status;
    } else if (data.status !== undefined) {
      targetStatus = data.status;
    }

    if (!canTransition(order.status, targetStatus)) {
      throw appError(
        'INVALID_STATUS_TRANSITION',
        `Invalid transition: ${order.status} -> ${targetStatus}`,
        400
      );
    }

    payload.status = targetStatus;
    payload.pedidoEstado = pedidoEstado;
  }

  return prisma.order.update({
    where: { id },
    data: payload,
  });
}

export async function updateStatus(id: string, status: string, pedidoEstado?: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw appError('ORDER_NOT_FOUND', 'Order not found', 404);
  }

  let targetStatus = status;
  if (pedidoEstado) {
    const legacyMap: Record<string, string> = {
      pendiente: 'created',
      confirmado: 'confirmed',
      en_preparacion: 'in_preparation',
      listo: 'ready',
      entregado: 'completed',
      finalizado: 'completed',
      cancelado: 'cancelled',
    };
    targetStatus = legacyMap[pedidoEstado] || status;
  }

  if (!canTransition(order.status, targetStatus)) {
    throw appError(
      'INVALID_STATUS_TRANSITION',
      `Invalid transition: ${order.status} -> ${targetStatus}`,
      400
    );
  }

  return prisma.order.update({
    where: { id },
    data: { status: targetStatus },
  });
}

export async function remove(id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw appError('ORDER_NOT_FOUND', 'Order not found', 404);
  }

  await prisma.order.delete({ where: { id } });
  return { success: true };
}
