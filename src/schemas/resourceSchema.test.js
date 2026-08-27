import { describe, it, expect } from 'vitest';
import { normalizeResource, resourceToMesa } from './resourceSchema.js';
import { normalizeOrganization } from './organizationSchema.js';
import { getAvailableResources, checkResourceAvailability } from '../services/availabilityService.js';

describe('normalizeResource (compat con docs legacy de mesas)', () => {
  it('convierte un doc de mesas/{id} en recurso type=table', () => {
    const r = normalizeResource({ id: 'm1', name: 'M1', capacity: 4, number: 1, shape: 'round' });
    expect(r).toMatchObject({
      id: 'm1', name: 'M1', capacity: 4, type: 'table', status: 'active',
      organizationId: 'default', shape: 'round', number: 1,
    });
    expect(r.metadata).toEqual({});
  });

  it('respeta el modelo nuevo de resources/{id}', () => {
    const r = normalizeResource({
      id: 'res-001', organizationId: 'org-1', name: 'Cancha 1', type: 'court',
      capacity: 10, status: 'active', position: { x: 100, y: 200 },
      metadata: { sport: 'padel' },
    });
    expect(r.type).toBe('court');
    expect(r.position).toEqual({ x: 100, y: 200 });
    expect(r.metadata.sport).toBe('padel');
  });

  it('resourceToMesa mantiene la vista legacy para el plano', () => {
    const mesa = resourceToMesa(normalizeResource({ id: 'm1', capacity: 4, shape: 'square' }));
    expect(mesa).toMatchObject({ id: 'm1', capacity: 4, shape: 'square' });
  });
});

describe('normalizeOrganization', () => {
  it('devuelve la organización default sin datos', () => {
    const org = normalizeOrganization(null);
    expect(org.businessType).toBe('restaurant');
    expect(org.id).toBe('default');
    expect(org.bookingFields.length).toBeGreaterThan(0);
  });

  it('normaliza un doc con businessType salon', () => {
    const org = normalizeOrganization({ id: 'org-2', name: 'Estudio', businessType: 'salon' });
    expect(org.businessType).toBe('salon');
    expect(org.name).toBe('Estudio');
  });

  it('respeta bookingFields personalizados', () => {
    const org = normalizeOrganization({
      id: 'org-3', businessType: 'custom',
      bookingFields: [{ name: 'service', label: 'Servicio', type: 'select', required: true, options: ['A', 'B'] }],
    });
    expect(org.bookingFields[0].name).toBe('service');
  });
});

describe('getAvailableResources', () => {
  const resources = [
    { id: 'm1', name: 'M1', capacity: 2, status: 'active' },
    { id: 'm2', name: 'M2', capacity: 4, status: 'active' },
    { id: 'm3', name: 'M3', capacity: 8, status: 'inactive' },
  ];
  const reservations = [
    { id: 'r1', tableId: 'm1', date: '2026-08-27', service: 'cena', time: '19:00', duration: 120 },
  ];

  it('filtra por superposición de horarios', () => {
    const available = getAvailableResources({
      resources, reservations, date: '2026-08-27', service: 'cena', time: '20:00', duration: 120,
    });
    expect(available.map(r => r.id)).toEqual(['m2']);
  });

  it('filtra por capacidad mínima', () => {
    const available = getAvailableResources({
      resources, reservations, date: '2026-08-27', service: 'cena',
      time: '22:00', duration: 120, partySize: 4,
    });
    expect(available.map(r => r.id)).toEqual(['m2']);
  });

  it('excluye recursos inactivos', () => {
    const available = getAvailableResources({
      resources: [resources[2]], reservations: [], date: '2026-08-27', service: 'cena', time: '20:00',
    });
    expect(available).toHaveLength(0);
  });
});

describe('checkResourceAvailability', () => {
  const resources = [
    { id: 'm1', name: 'M1', capacity: 4, status: 'active' },
    { id: 'm2', name: 'M2', capacity: 4, status: 'active' },
  ];
  const reservations = [
    { id: 'r1', tableId: 'm1', date: '2026-08-27', service: 'cena', time: '19:00', duration: 120 },
  ];

  it('devuelve alternativas cuando el recurso está ocupado', () => {
    const res = checkResourceAvailability('m1', {
      resources, reservations, date: '2026-08-27', service: 'cena', time: '20:00', duration: 120, partySize: 4,
    });
    expect(res.available).toBe(false);
    expect(res.conflicts.map(c => c.id)).toEqual(['r1']);
    expect(res.alternatives.map(r => r.id)).toEqual(['m2']);
  });

  it('reporta disponible sin conflictos', () => {
    const res = checkResourceAvailability('m2', {
      resources, reservations, date: '2026-08-27', service: 'cena', time: '20:00', duration: 120, partySize: 4,
    });
    expect(res.available).toBe(true);
    expect(res.alternatives).toEqual([]);
  });
});
