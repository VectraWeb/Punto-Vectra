import { useState } from 'react';
import { Check } from 'lucide-react';
import { setPrimaryColor, getPrimaryColor } from '../utils';

const PRESETS = [
  { name: 'Azul', hex: '#0086c9' },
  { name: 'Rojo', hex: '#dc2626' },
  { name: 'Naranja', hex: '#ea580c' },
  { name: 'Ámbar', hex: '#d97706' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Turquesa', hex: '#0891b2' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Gris', hex: '#52525b' },
];

export default function ThemeSelector() {
  const [selected, setSelected] = useState(getPrimaryColor());
  const [custom, setCustom] = useState(getPrimaryColor());

  const apply = (hex) => {
    setSelected(hex);
    setCustom(hex);
    setPrimaryColor(hex);
  };

  return (
    <div style={{ background: 'var(--color-cream)', borderRadius: '14px', padding: '20px', border: '1px solid var(--color-cream-deep)' }}>
      <div style={{ fontWeight: 600, color: 'var(--color-forest)', fontSize: '14px', marginBottom: '14px' }}>Tema de la app</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {PRESETS.map(p => {
          const isActive = selected === p.hex;
          return (
            <button key={p.hex} onClick={() => apply(p.hex)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 6px', borderRadius: '12px', border: isActive ? `2px solid ${p.hex}` : '2px solid var(--color-cream-deep)',
                background: isActive ? `${p.hex}15` : '#fff', cursor: 'pointer', transition: 'all 0.15s'
              }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: p.hex,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: isActive ? '2px solid #fff' : 'none', boxShadow: isActive ? `0 0 0 2px ${p.hex}` : 'none'
              }}>
                {isActive && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-espresso)', fontWeight: isActive ? 600 : 400 }}>{p.name}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>Personalizado:</label>
        <input type="color" value={custom}
          onChange={e => { setCustom(e.target.value); }}
          onBlur={e => apply(e.target.value)}
          style={{ width: '36px', height: '30px', border: '1px solid var(--color-cream-deep)', borderRadius: '8px', cursor: 'pointer', padding: 0 }}
        />
        <input type="text" value={custom}
          onChange={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setCustom(e.target.value); }}
          onBlur={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) apply(e.target.value); }}
          style={{
            flex: 1, padding: '6px 10px', border: '1px solid var(--color-cream-deep)', borderRadius: '8px',
            fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-espresso)', background: '#fff'
          }}
        />
      </div>
    </div>
  );
}
