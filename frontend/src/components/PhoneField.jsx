import { inp } from '../utils';
import { Field } from './ui';

const PAISES = [
  { code: '54', label: 'AR +54' },
  { code: '598', label: 'UY +598' },
  { code: '595', label: 'PY +595' },
  { code: '56', label: 'CL +56' },
  { code: '55', label: 'BR +55' },
  { code: '591', label: 'BO +591' },
  { code: '51', label: 'PE +51' },
  { code: '57', label: 'CO +57' },
  { code: '34', label: 'ES +34' },
  { code: '1', label: 'US +1' },
];

const parse = (full) => {
  const digits = String(full || '').replace(/[^0-9]/g, '');
  const sorted = [...PAISES].sort((a, b) => b.code.length - a.code.length);
  for (const p of sorted) {
    if (digits.startsWith(p.code)) return { code: p.code, national: digits.slice(p.code.length) };
  }
  return { code: '54', national: digits };
};

export default function PhoneField({ label = 'Teléfono', value = '', onChange, placeholder = '11 5555-1234' }) {
  const { code, national } = parse(value);

  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select
          value={code}
          onChange={e => onChange(e.target.value + national)}
          style={{ ...inp, width: '88px', flexShrink: 0, fontSize: '14px', padding: '8px 4px' }}
        >
          {PAISES.map(p => (
            <option key={p.code} value={p.code}>{p.label}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={national}
          onChange={e => onChange(code + e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={placeholder}
          style={inp}
        />
      </div>
    </Field>
  );
}
