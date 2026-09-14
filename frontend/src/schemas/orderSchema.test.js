import { describe, it, expect } from 'vitest';
import {
  normalizeOrder, normalizeOrderItem, orderStatusOf, canTransitionOrder, legacyStatusOf,
} from './orderSchema.js';
import { normalizeCustomer, customerDocId, EMPTY_CUSTOMER_STATS } from './customerSchema.js';
import { normalizeBranch, DEFAULT_BRANCH_ID } from './branchSchema.js';

describe('normalizeOrderItem', () => {
  it('calcula subtotal y defaults', () => {
    const item = normalizeOrderItem({ productId: 'p1', name: 'Corte', quantity: 2, unitPrice: 100 }, 0);
    expect(item.subtotal).toBe(200);
    expect(item.type).toBe('product');
    expect(item.status).toBe('pending');
  });

  it('respeta subtotal explícito y modifiers', () => {
    const item = normalizeOrderItem({ name: 'Color', unitPrice: 50, subtotal: 80, modifiers: ['tratamiento'] }, 1);
    expect(item.subtotal).toBe(80);
    expect(item.modifiers).toEqual(['tratamiento']);
  });
});

describe('normalizeOrder (compat pedidos legacy)', () => {
  it('mapea pedidoEstado legacy a status genérico', () => {
    const o = normalizeOrder({ id: 'p1', customerName: 'Juan', pedidoEstado: 'en_preparacion', items: [{ name: 'Café', unitPrice: 20, quantity: 2 }] });
    expect(o.status).toBe('in_preparation');
    expect(o.organizationId).toBe('default');
    expect(o.branchId).toBe('main');
    expect(o.totals.subtotal).toBe(40);
    expect(o.totals.total).toBe(40);
  });

  it('respeta items y totals explícitos', () => {
    const o = normalizeOrder({ id: 'p2', status: 'confirmed', totals: { subtotal: 10, discounts: 1, taxes: 2, total: 11 } });
    expect(o.status).toBe('confirmed');
    expect(o.totals.total).toBe(11);
  });
});

describe('máquina de estados de pedidos', () => {
  it('permite el flujo normal', () => {
    expect(canTransitionOrder('created', 'confirmed')).toBe(true);
    expect(canTransitionOrder('confirmed', 'in_preparation')).toBe(true);
    expect(canTransitionOrder('in_preparation', 'ready')).toBe(true);
    expect(canTransitionOrder('ready', 'completed')).toBe(true);
  });

  it('bloquea saltos inválidos', () => {
    expect(canTransitionOrder('created', 'ready')).toBe(false);
    expect(canTransitionOrder('completed', 'confirmed')).toBe(false);
    expect(canTransitionOrder('cancelled', 'confirmed')).toBe(false);
  });

  it('orderStatusOf y legacyStatusOf son inversos', () => {
    expect(orderStatusOf({ pedidoEstado: 'listo' })).toBe('ready');
    expect(legacyStatusOf('ready')).toBe('listo');
  });
});

describe('customerSchema', () => {
  it('genera doc id determinista por org+teléfono', () => {
    expect(customerDocId('org-1', '+54 11 5555-1234')).toBe('org-1_541155551234');
    expect(customerDocId('org-1', '+54 11 5555-1234')).toBe(customerDocId('org-1', '541155551234'));
  });

  it('normaliza stats con defaults', () => {
    const c = normalizeCustomer({ id: 'x_1', phone: '1', stats: { reservations: 5 } });
    expect(c.stats.reservations).toBe(5);
    expect(c.stats.noShows).toBe(0);
    expect(EMPTY_CUSTOMER_STATS.totalSpent).toBe(0);
  });
});

describe('branchSchema', () => {
  it('normaliza sucursal con defaults', () => {
    const b = normalizeBranch({ id: 'main', name: 'Centro' }, 'org-1');
    expect(b.organizationId).toBe('org-1');
    expect(b.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(DEFAULT_BRANCH_ID).toBe('main');
  });
});
