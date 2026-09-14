import { describe, it, expect } from 'vitest';
import {
  reservationStatusOf, canTransitionReservation, assertValidTransition,
  RESERVATION_TRANSITIONS, eventForStatus,
} from './reservationStates.js';

describe('reservationStatusOf (compat legacy)', () => {
  it('mapea estados legacy a genéricos', () => {
    expect(reservationStatusOf({ estado: 'pendiente' })).toBe('pending');
    expect(reservationStatusOf({ estado: 'confirmada' })).toBe('confirmed');
    expect(reservationStatusOf({ estado: 'cancelado' })).toBe('cancelled');
    expect(reservationStatusOf({})).toBe('pending');
  });

  it('respeta el estado genérico explícito', () => {
    expect(reservationStatusOf({ status: 'checked_in', estado: 'confirmada' })).toBe('checked_in');
  });
});

describe('máquina de transiciones', () => {
  it('permite el flujo feliz', () => {
    expect(canTransitionReservation('pending', 'confirmed')).toBe(true);
    expect(canTransitionReservation('confirmed', 'checked_in')).toBe(true);
    expect(canTransitionReservation('checked_in', 'in_progress')).toBe(true);
    expect(canTransitionReservation('in_progress', 'completed')).toBe(true);
  });

  it('permite cancelar desde estados activos', () => {
    expect(canTransitionReservation('pending', 'cancelled')).toBe(true);
    expect(canTransitionReservation('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionReservation('in_progress', 'cancelled')).toBe(true);
  });

  it('bloquea transiciones inválidas', () => {
    expect(canTransitionReservation('completed', 'confirmed')).toBe(false);
    expect(canTransitionReservation('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionReservation('pending', 'checked_in')).toBe(false);
    expect(canTransitionReservation('confirmed', 'completed')).toBe(false);
  });

  it('no_show y expired son terminales', () => {
    expect(RESERVATION_TRANSITIONS.no_show).toEqual([]);
    expect(RESERVATION_TRANSITIONS.expired).toEqual([]);
  });

  it('assertValidTransition lanza error de dominio', () => {
    expect(() => assertValidTransition('cancelled', 'confirmed')).toThrowError(/Transición inválida/);
    expect(() => assertValidTransition('pending', 'checked_in')).toThrow();
    expect(assertValidTransition('confirmed', 'checked_in')).toBe('checked_in');
  });
});

describe('eventForStatus', () => {
  it('mapea estados a eventos de dominio', () => {
    expect(eventForStatus('checked_in')).toBe('reservation.checked_in');
    expect(eventForStatus('cancelled')).toBe('reservation.cancelled');
    expect(eventForStatus('pending')).toBe(null);
  });
});
