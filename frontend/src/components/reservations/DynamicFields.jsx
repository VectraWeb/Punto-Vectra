// DynamicFields.jsx — Campos personalizados de reserva según la organización.
// Renderiza inputs (text, number, select, textarea) desde org.bookingFields y
// los valores viven en reservation.metadata.

import { Field } from '../ui';
import { C } from '../../utils';
import { CORE_BOOKING_FIELD_NAMES } from '../../config/businessTypes';

const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
};

/**
 * @param {Object} props
 * @param {Object[]} props.fields - [{ name, label, type, required, options }]
 * @param {Object} [props.values] - metadata actual
 * @param {Function} props.onChange - (name, value)
 * @param {string[]} [props.exclude] - nombres a omitir (ya cubiertos por el form)
 */
export default function DynamicFields({ fields = [], values = {}, onChange, exclude = [] }) {
  const skip = new Set([...CORE_BOOKING_FIELD_NAMES, ...exclude]);
  const visible = (fields || []).filter(f => f && f.name && !skip.has(f.name));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map(f => {
        const value = values[f.name] != null ? values[f.name] : '';
        return (
          <Field key={f.name} label={f.required ? `${f.label} *` : f.label}>
            {f.type === 'select' ? (
              <select
                value={value}
                onChange={e => onChange(f.name, e.target.value)}
                style={inp}
              >
                <option value="">— elegir —</option>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                value={value}
                onChange={e => onChange(f.name, e.target.value)}
                rows={2}
                placeholder={f.placeholder || ''}
                style={{ ...inp, resize: 'vertical' }}
              />
            ) : f.type === 'number' ? (
              <input
                type="number"
                min={f.min ?? 0}
                value={value}
                onChange={e => onChange(f.name, e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={f.placeholder || ''}
                style={inp}
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={e => onChange(f.name, e.target.value)}
                placeholder={f.placeholder || ''}
                style={inp}
              />
            )}
          </Field>
        );
      })}
    </>
  );
}
