import React, { useState } from 'react';
import { X } from 'lucide-react';
import { C } from '../utils';
import { Overlay } from './LiveStateModal';

export function Counter({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.creamDeep}` }}>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.creamDeep, border: 'none', cursor: 'pointer', fontSize: '18px', color: C.espresso }}>−</button>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontWeight: 600, color: C.forest, minWidth: '28px', textAlign: 'center' }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.terra, border: 'none', cursor: 'pointer', fontSize: '18px', color: '#fff' }}>+</button>
      </div>
    </div>
  );
}

export default function SettingsModal({ config, onSave, onClose }) {
  const [local, setLocal] = useState({ ...config });
  const set = (k, v) => setLocal(l => ({ ...l, [k]: v }));
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Configuración</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>
      <p style={{ fontSize: '12px', color: C.muted, marginBottom: '16px' }}>Cantidad de mesas por capacidad. Los cambios se sincronizan a todos los dispositivos.</p>
      {[['cap2', 'Mesas de 2'], ['cap4', 'Mesas de 4'], ['cap5', 'Mesas de 5'], ['cap8', 'Mesas de 8']].map(([k, label]) => (
        <Counter key={k} label={label} value={local[k] || 0} onChange={v => set(k, v)} />
      ))}
      <button onClick={() => { onSave(local); onClose(); }} style={{
        width: '100%', marginTop: '20px', padding: '14px',
        background: C.forest, border: 'none', borderRadius: '12px',
        cursor: 'pointer', color: C.cream, fontSize: '15px', fontWeight: 600,
      }}>Guardar configuración</button>
    </Overlay>
  );
}
