import { describe, it, expect } from 'vitest';
import { t2m, m2t, genSlots, buildTables, todayISO, detectService, SERVICES, DEFAULT_CONFIG, timeBelongsToService, serviceFromTime } from './utils.js';

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
  it('builds tables from new array config', () => {
    const cfg = [
      { id: 1, capacidad: 2, forma: 'rectangular', cantidad: 2 },
      { id: 2, capacidad: 4, forma: 'rectangular', cantidad: 1 },
      { id: 3, capacidad: 6, forma: 'redonda', cantidad: 1 },
    ];
    const tables = buildTables(cfg);
    expect(tables).toHaveLength(4);
    expect(tables[0]).toEqual({ id: 'm1', name: 'M1', capacity: 2, shape: 'rectangular', number: 1 });
    expect(tables[1]).toEqual({ id: 'm2', name: 'M2', capacity: 2, shape: 'rectangular', number: 2 });
    expect(tables[2]).toEqual({ id: 'm3', name: 'M3', capacity: 4, shape: 'rectangular', number: 3 });
    expect(tables[3]).toEqual({ id: 'm4', name: 'M4', capacity: 6, shape: 'round', number: 4 });
  });

  it('builds tables from old object config (backward compat)', () => {
    const tables = buildTables({ cap2: 2, cap4: 1, cap5: 0, cap8: 0 });
    expect(tables).toHaveLength(3);
    expect(tables[0]).toEqual({ id: 'm1', name: 'M1', capacity: 2, shape: 'square', number: 1 });
    expect(tables[1]).toEqual({ id: 'm2', name: 'M2', capacity: 2, shape: 'square', number: 2 });
    expect(tables[2]).toEqual({ id: 'm3', name: 'M3', capacity: 4, shape: 'rectangular', number: 3 });
  });

  it('returns empty for old zero config', () => {
    expect(buildTables({ cap2: 0, cap4: 0, cap5: 0, cap8: 0 })).toHaveLength(0);
  });

  it('returns empty for new zero config', () => {
    expect(buildTables([{ id: 1, capacidad: 2, forma: 'rectangular', cantidad: 0 }])).toHaveLength(0);
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

describe('timeBelongsToService', () => {
  it('acepta la apertura del mediodía (regresión: 11:30 quedaba fuera)', () => {
    expect(timeBelongsToService('11:30', 'mediodia')).toBe(true);
    expect(timeBelongsToService('11:45', 'mediodia')).toBe(true);
    expect(timeBelongsToService('15:00', 'mediodia')).toBe(true);
  });

  it('rechaza fuera del mediodía', () => {
    expect(timeBelongsToService('11:00', 'mediodia')).toBe(false);
    expect(timeBelongsToService('15:15', 'mediodia')).toBe(false);
    expect(timeBelongsToService('19:00', 'mediodia')).toBe(false);
  });

  it('acepta la cena cruzando medianoche', () => {
    expect(timeBelongsToService('19:30', 'cena')).toBe(true);
    expect(timeBelongsToService('00:30', 'cena')).toBe(true);
    expect(timeBelongsToService('01:00', 'cena')).toBe(true);
  });

  it('rechaza fuera de la cena', () => {
    expect(timeBelongsToService('18:00', 'cena')).toBe(false);
    expect(timeBelongsToService('01:15', 'cena')).toBe(false);
  });

  it('rechaza inputs inválidos', () => {
    expect(timeBelongsToService('', 'cena')).toBe(false);
    expect(timeBelongsToService('abc', 'cena')).toBe(false);
    expect(timeBelongsToService('20:00', 'nada')).toBe(false);
  });
});

describe('serviceFromTime', () => {
  it('detecta el mediodía desde las 11:30 (regresión)', () => {
    expect(serviceFromTime('11:30')).toBe('mediodia');
    expect(serviceFromTime('13:00')).toBe('mediodia');
  });

  it('detecta la cena incluyendo medianoche', () => {
    expect(serviceFromTime('20:00')).toBe('cena');
    expect(serviceFromTime('00:30')).toBe('cena');
  });

  it('devuelve el fallback fuera de horario', () => {
    expect(serviceFromTime('16:00')).toBeUndefined();
    expect(serviceFromTime('16:00', 'cena')).toBe('cena');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('is an array of mesa tipos', () => {
    expect(Array.isArray(DEFAULT_CONFIG)).toBe(true);
    expect(DEFAULT_CONFIG.length).toBeGreaterThan(0);
    for (const item of DEFAULT_CONFIG) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('capacidad');
      expect(item).toHaveProperty('forma');
      expect(item).toHaveProperty('cantidad');
    }
  });
});
