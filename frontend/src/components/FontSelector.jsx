import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { setLogoFont, getLogoFont, LOGO_FONTS } from '../utils';

export default function FontSelector({ previewName = 'PuntoVectra' }) {
  const [selected, setSelected] = useState(getLogoFont());

  const apply = (name) => {
    setSelected(name);
    setLogoFont(name);
  };

  const current = LOGO_FONTS.find(f => f.name === selected);

  return (
    <div>
      <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
        Tipografía del nombre
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: current?.family || '"Fraunces", serif',
          fontSize: '20px', fontWeight: 600, color: 'var(--color-espresso)',
          padding: '10px 12px', background: 'var(--color-white)',
          border: '1.5px solid var(--color-cream-deep)', borderRadius: '10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{previewName}</span>
          <ChevronDown size={16} color="var(--color-muted)" />
        </div>
        <select
          value={selected}
          onChange={e => apply(e.target.value)}
          style={{
            position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
            width: '100%', height: '100%',
          }}
        >
          {LOGO_FONTS.map(f => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
