import { describe, it, expect } from 'vitest';
import {
  normalizeReservation,
  reservationStartMinutes,
  reservationEndMinutes,
  minutesOverlap,
  reservationsOverlap,
  findConflictingReservations,
} from './reservationSchema.js';

describe('normalizeReservation', () => {
  it('resuelve resourceId desde resourceId/tableId/mesa_id', () => {
    expect(normalizeReservation({ id: 'r1', resourceId: 'a' }).resourceId).toBe('a');
    expect(normalizeReservation({ id: 'r2', tableId: 'm5' }).resourceId).toBe('m5');
    expect(normalizeReservation({ id: 'r3', mesa_id: 'm7' }).resourceId).toBe('m7');
    expect(normalizeReservation({ id: 'r4' }).resourceId).toBe(null);
  });

  it('agrega organizationId default y metadata guests desde partySize', () => {
    const r = normalizeReservation({ id: 'r1', tableId: 'm1', partySize: 4 });
    expect(r.organizationId).toBe('default');
    expect(r.metadata.guests).toBe(4);
  });

  it('no muta el documento original', () => {
    const raw = { id: 'r1', tableId: 'm1', partySize: 4 };
    normalizeReservation(raw);
    expect(raw.metadata).toBeUndefined();
    expect(raw.resourceId).toBeUndefined();
  });
});

describe('tiempo de reserva', () => {
  it('calcula start/end en minutos con cena cruzando medianoche', () => {
    expect(reservationStartMinutes({ time: '20:00', service: 'cena' })).toBe(1200);
    expect(reservationEndMinutes({ time: '20:00', service: 'cena', duration: 120 })).toBe(1320);
    expect(reservationStartMinutes({ time: '00:30', service: 'cena' })).toBe(1470);
  });
});

describe('minutesOverlap (regla general newStart < existingEnd && newEnd > existingStart)', () => {
  it('bloquea 18:00-20:00 contra 19:00-21:00', () => {
    expect(minutesOverlap(1080, 1200, 1140, 1260)).toBe(true);
  });
  it('bloquea 19:00-20:00 contra 18:00-21:00 (contenida)', () => {
    expect(minutesOverlap(1140, 1200, 1080, 1260)).toBe(true);
  });
  it('bloquea 18:00-21:00 contra 19:00-20:00 (contiene)', () => {
    expect(minutesOverlap(1080, 1260, 1140, 1200)).toBe(true);
  });
  it('permite 18:00-19:00 contra 19:00-20:00 (lindantes no se superponen)', () => {
    expect(minutesOverlap(1080, 1140, 1140, 1200)).toBe(false);
  });
  it('permite 18:00-19:00 contra 20:00-21:00', () => {
    expect(minutesOverlap(1080, 1140, 1200, 1260)).toBe(false);
  });
});

describe('reservationsOverlap', () => {
  const base = { id: 'a', resourceId: 'm1', date: '2026-08-27', service: 'cena', time: '20:00', duration: 120 };
  it('detecta superposición entre dos reservas del mismo recurso/turno', () => {
    const b = { id: 'b', resourceId: 'm1', date: '2026-08-27', service: 'cena', time: '21:00', duration: 120 };
    expect(reservationsOverlap(base, b)).toBe(true);
  });
  it('ignora si son la misma reserva', () => {
    expect(reservationsOverlap(base, { ...base })).toBe(false);
  });
  it('ignora recursos distintos', () => {
    const b = { id: 'b', resourceId: 'm2', date: '2026-08-27', service: 'cena', time: '20:00', duration: 120 };
    expect(reservationsOverlap(base, b)).toBe(false);
  });
  it('ignora servicios distintos', () => {
    const b = { id: 'b', resourceId: 'm1', date: '2026-08-27', service: 'mediodia', time: '20:00', duration: 120 };
    expect(reservationsOverlap(base, b)).toBe(false);
  });
  it('no superpone horarios lindantes', () => {
    const b = { id: 'b', resourceId: 'm1', date: '2026-08-27', service: 'cena', time: '22:00', duration: 120 };
    expect(reservationsOverlap(base, b)).toBe(false);
  });
});

describe('findConflictingReservations', () => {
  const existing = [
    { id: 'r1', tableId: 'm1', date: '2026-08-27', service: 'cena', time: '19:00', duration: 120 },
    { id: 'r2', tableId: 'm1', date: '2026-08-27', service: 'cena', time: '23:00', duration: 120 },
    { id: 'r3', tableId: 'm2', date: '2026-08-27', service: 'cena', time: '19:00', duration: 120 },
    { id: 'r4', tableId: 'm1', date: '2026-08-27', service: 'cena', time: '19:30', duration: 60, estado: 'cancelado' },
  ];
  it('encuentra solo los conflictos reales del mismo recurso', () => {
    const conflicts = findConflictingReservations(
      { resourceId: 'm1', date: '2026-08-27', service: 'cena', time: '20:00', duration: 120 },
      existing
    );
    expect(conflicts.map(c => c.id)).toEqual(['r1']);
  });
  it('excluye cancelados y la propia reserva', () => {
    const conflicts = findConflictingReservations(
      { id: 'r1', resourceId: 'm1', date: '2026-08-27', service: 'cena', time: '20:00', duration: 120 },
      existing
    );
    expect(conflicts).toHaveLength(0);
  });
  it('usa mesa_id legacy como resourceId', () => {
    const conflicts = findConflictingReservations(
      { mesa_id: 'm2', date: '2026-08-27', service: 'cena', time: '19:30', duration: 60 },
      existing
    );
    expect(conflicts.map(c => c.id)).toEqual(['r3']);
  });
});
