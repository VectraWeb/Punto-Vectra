import { useMemo } from 'react';
import { inp } from '../utils';
import { Field } from './ui';

const PAISES = [
  { code: '54', name: 'Argentina 🇦🇷', short: 'Arg 🇦🇷' },
  { code: '598', name: 'Uruguay 🇺🇾', short: 'Uru 🇺🇾' },
  { code: '595', name: 'Paraguay 🇵🇾', short: 'Par 🇵🇾' },
  { code: '56', name: 'Chile 🇨🇱', short: 'Chi 🇨🇱' },
  { code: '55', name: 'Brasil 🇧🇷', short: 'Bra 🇧🇷' },
  { code: '591', name: 'Bolivia 🇧🇴', short: 'Bol 🇧🇴' },
  { code: '51', name: 'Perú 🇵🇪', short: 'Per 🇵🇪' },
  { code: '57', name: 'Colombia 🇨🇴', short: 'Col 🇨🇴' },
  { code: '34', name: 'España 🇪🇸', short: 'Esp 🇪🇸' },
  { code: '1', name: 'Estados Unidos 🇺🇸', short: 'EE. UU. 🇺🇸' },
];

// Convierte la parte nacional al formato internacional argentino cuando
// corresponde: saca el 0 inicial y convierte "15" móvil (011 15...) a "9".
const normalizeNational = (n) => {
  let d = String(n || '').replace(/[^\d]/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m) d = m[1] + '9' + m[2];
  return d;
};

const parse = (full) => {
  const digits = String(full || '').replace(/[^\d]/g, '');
  const sorted = [...PAISES].sort((a, b) => b.code.length - a.code.length);
  for (const p of sorted) {
    if (digits.startsWith(p.code)) return { code: p.code, national: digits.slice(p.code.length) };
  }
  return { code: '54', national: digits };
};

export default function PhoneField({ label = 'Teléfono', value = '', onChange, placeholder = '11 5555-1234' }) {
  const { code, national } = useMemo(() => parse(value), [value]);

  const emit = (c, n) => onChange(c + normalizeNational(n));

  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select
          value={code}
          onChange={e => emit(e.target.value, national)}
          style={{ ...inp, width: '132px', flexShrink: 0 }}
        >
          {PAISES.map(p => (
            <option key={p.code} value={p.code}>{p.short} (+{p.code})</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={national}
          onChange={e => emit(code, e.target.value)}
          placeholder={placeholder}
          style={inp}
        />
      </div>
    </Field>
  );
}
