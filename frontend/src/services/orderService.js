// orderService.js — Pedidos genéricos mediante API REST.

import { orderApi } from './api';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { normalizeOrder } from '../schemas/orderSchema';

/**
 * Crea un pedido genérico.
 */
export async function createOrder(order) {
  const { data } = await orderApi.create(order);
  return { id: data.id, order: normalizeOrder(data) };
}

/**
 * Cambia el estado de un pedido.
 */
export async function updateOrderStatus(orderId, nextStatus, opts = {}) {
  await orderApi.updateStatus(orderId, nextStatus);
  return nextStatus;
}
