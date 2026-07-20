import { describe, it, expect } from 'vitest';
import { t2m, m2t, genSlots, buildTables, todayISO, detectService, SERVICES, DEFAULT_CONFIG } from './utils.js';

describe('t2m (time to minutes)', () => {
  it('converts normal time correctly', () => {
    expect(t2m('12:00', 'mediodia')).toBe(720);
    expect(t2m('00:00', 'mediodia')).toBe(0);
    expect(t2m('23:59', 'mediodia')).toBe(1439);
  });

  it('handles cena overnight correctly', () => {
    expect(t2m('00:30', 'cena')).toBe(1470); // (0+24)*60 + 30
    expect(t2m('01:00', 'cena')).toBe(1500);
    expect(t2m('19:30', 'cena')).toBe(1170);
  });

  it('returns 0 for empty input', () => {
    expect(t2m('', 'mediodia')).toBe(0);
    expect(t2m(null, 'mediodia')).toBe(0);
    expect(t2m(undefined, 'mediodia')).toBe(0);
  });
});

describe('m2t (minutes to time)', () => {
  it('converts correctly', () => {
    expect(m2t(0)).toBe('00:00');
    expect(m2t(720)).toBe('12:00');
    expect(m2t(1439)).toBe('23:59');
    expect(m2t(65)).toBe('01:05');
  });
});

describe('genSlots', () => {
  it('generates mediodia slots', () => {
    const slots = genSlots('mediodia');
    expect(slots[0]).toBe('11:30');
    expect(slots).toContain('12:00');
    expect(slots).toContain('15:00');
    expect(slots.length).toBeGreaterThan(10);
  });

  it('generates cena slots', () => {
    const slots = genSlots('cena');
    expect(slots[0]).toBe('19:30');
    expect(slots).toContain('20:00');
    expect(slots).toContain('00:00');
    expect(slots).toContain('01:00');
  });
});

describe('buildTables', () => {
  it('builds tables from config', () => {
    const tables = buildTables({ cap2: 2, cap4: 1, cap5: 0, cap8: 0 });
    expect(tables).toHaveLength(3);
    expect(tables[0]).toEqual({ id: 'm1', name: 'M1', capacity: 2, shape: 'rectangular' });
    expect(tables[1]).toEqual({ id: 'm2', name: 'M2', capacity: 2, shape: 'rectangular' });
    expect(tables[2]).toEqual({ id: 'm3', name: 'M3', capacity: 4, shape: 'rectangular' });
  });

  it('returns empty for zero config', () => {
    expect(buildTables({ cap2: 0, cap4: 0, cap5: 0, cap8: 0 })).toHaveLength(0);
  });
});

describe('todayISO', () => {
  it('returns local date in YYYY-MM-DD format', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('detectService', () => {
  it('returns mediodia or cena', () => {
    const result = detectService();
    expect(['mediodia', 'cena']).toContain(result);
  });
});

describe('SERVICES', () => {
  it('has mediodia and cena', () => {
    expect(SERVICES.mediodia).toBeDefined();
    expect(SERVICES.cena).toBeDefined();
    expect(SERVICES.mediodia.start).toBe('11:30');
    expect(SERVICES.mediodia.end).toBe('15:00');
    expect(SERVICES.cena.start).toBe('19:30');
    expect(SERVICES.cena.end).toBe('01:00');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has all capacity keys', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('cap2');
    expect(DEFAULT_CONFIG).toHaveProperty('cap4');
    expect(DEFAULT_CONFIG).toHaveProperty('cap5');
    expect(DEFAULT_CONFIG).toHaveProperty('cap8');
  });
});
