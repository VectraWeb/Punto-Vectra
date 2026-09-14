import { describe, it, expect } from 'vitest';
import { parseMenuText, parsePrice } from './menuParser.js';

describe('parsePrice', () => {
  it('entiende formato argentino', () => {
    expect(parsePrice('$1.200')).toBe(1200);
    expect(parsePrice('12.000')).toBe(12000);
    expect(parsePrice('$1.200,50')).toBe(1200.5);
    expect(parsePrice('1200,50')).toBe(1200.5);
    expect(parsePrice('1222')).toBe(1222);
    expect(parsePrice('')).toBe(0);
  });
});

describe('parseMenuText', () => {
  it('categorías en mayúsculas + ítems con $', () => {
    const items = parseMenuText('BEBIDAS\nCoca $1222\nAgua $800\nFIDEOS\nFideos blancos $4000');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ name: 'Coca', price: 1222, category: 'BEBIDAS' });
    expect(items[1]).toMatchObject({ name: 'Agua', price: 800, category: 'BEBIDAS' });
    expect(items[2]).toMatchObject({ name: 'Fideos blancos', price: 4000, category: 'FIDEOS' });
  });

  it('separadores y miles con punto', () => {
    const items = parseMenuText('Coca - $1.200\nMilanesa .... 4500\nEnsalada: 12000');
    expect(items[0]).toMatchObject({ name: 'Coca', price: 1200 });
    expect(items[1]).toMatchObject({ name: 'Milanesa', price: 4500 });
    expect(items[2]).toMatchObject({ name: 'Ensalada', price: 12000 });
  });

  it('CSV nombre,precio,categoria', () => {
    const items = parseMenuText('Coca,1200,Bebidas\nAgua;800;Bebidas');
    expect(items[0]).toMatchObject({ name: 'Coca', price: 1200, category: 'Bebidas' });
    expect(items[1]).toMatchObject({ name: 'Agua', price: 800, category: 'Bebidas' });
  });

  it('encabezados con # y :', () => {
    const items = parseMenuText('## Bebidas\nCoca $500\nPostres:\nFlan $700');
    expect(items[0]).toMatchObject({ name: 'Coca', price: 500, category: 'Bebidas' });
    expect(items[1]).toMatchObject({ name: 'Flan', price: 700, category: 'Postres' });
  });

  it('no se come falsos positivos', () => {
    const items = parseMenuText('Promo 2x1\nMesa 12');
    expect(items.every(i => i.price === 0)).toBe(true);
  });

  it('ignora líneas vacías y bullets', () => {
    const items = parseMenuText('\n- Coca $500\n* Agua $300\n');
    expect(items).toHaveLength(2);
  });
});
