import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { C, SHAPE_LABELS, SHAPE_MAP, SHAPE_KEYS } from '../utils';
import { Overlay } from './LiveStateModal';

const CAPACIDAD_OPTIONS = [2, 4, 6, 8, 10, 12];

function Counter({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: '12px', color: C.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.creamDeep, border: 'none', cursor: 'pointer', fontSize: '16px', color: C.espresso, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontWeight: 600, color: C.forest, minWidth: '24px', textAlign: 'center' }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.terra, border: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
    </div>
  );
}

function TipoMesaCard({ item, index, onChange, onRemove }) {
  return (
    <div style={{ background: C.white, borderRadius: '14px', padding: '14px', border: `1px solid ${C.creamDeep}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: C.forest }}>
          {index + 1}. Mesa de {item.capacidad} {item.capacidad === 1 ? 'persona' : 'personas'}
        </span>
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e06060', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>Capacidad</label>
          <select value={item.capacidad} onChange={e => onChange({ ...item, capacidad: parseInt(e.target.value) })} style={{
            width: '100%', padding: '7px 8px', fontSize: '13px', borderRadius: '8px',
            border: `1px solid ${C.creamDeep}`, background: C.white, color: C.espresso, fontFamily: 'inherit',
          }}>
            {CAPACIDAD_OPTIONS.map(n => <option key={n} value={n}>{n} pers.</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>Forma</label>
          <select value={item.forma} onChange={e => onChange({ ...item, forma: e.target.value })} style={{
            width: '100%', padding: '7px 8px', fontSize: '13px', borderRadius: '8px',
            border: `1px solid ${C.creamDeep}`, background: C.white, color: C.espresso, fontFamily: 'inherit',
          }}>
            {SHAPE_KEYS.map(k => <option key={k} value={k}>{SHAPE_LABELS[k]}</option>)}
          </select>
        </div>
      </div>
      <Counter label="Cantidad de mesas" value={item.cantidad} onChange={v => onChange({ ...item, cantidad: v })} />
    </div>
  );
}

export default function SettingsModal({ config, onSave, onClose }) {
  const [local, setLocal] = useState(() => {
    if (Array.isArray(config) && config.length > 0) return config.map(c => ({ ...c }));
    return [
      { id: 1, capacidad: 2, forma: 'rectangular', cantidad: 4 },
      { id: 2, capacidad: 4, forma: 'rectangular', cantidad: 4 },
      { id: 3, capacidad: 6, forma: 'redonda', cantidad: 2 },
    ];
  });

  const [error, setError] = useState('');

  const updateItem = (index, newItem) => {
    const next = [...local];
    next[index] = newItem;
    setLocal(next);
    setError('');
  };

  const removeItem = (index) => {
    if (local.length <= 1) { setError('Debe haber al menos un tipo de mesa.'); return; }
    setLocal(local.filter((_, i) => i !== index));
    setError('');
  };

  const addItem = () => {
    const used = new Set(local.map(i => `${i.capacidad}-${i.forma}`));
    const candidates = [];
    for (const cap of CAPACIDAD_OPTIONS) {
      for (const forma of SHAPE_KEYS) {
        if (!used.has(`${cap}-${forma}`)) candidates.push({ capacidad: cap, forma });
      }
    }
    if (candidates.length === 0) { setError('Ya están todas las combinaciones posibles.'); return; }
    const pick = candidates[0];
    const maxId = Math.max(...local.map(i => i.id || 0), 0);
    setLocal([...local, { id: maxId + 1, capacidad: pick.capacidad, forma: pick.forma, cantidad: 1 }]);
    setError('');
  };

  const totalMesas = local.reduce((s, i) => s + i.cantidad, 0);

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Configuración</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>

      <p style={{ fontSize: '11px', color: C.muted, marginBottom: '12px', lineHeight: 1.4 }}>
        Definí los tipos de mesa: capacidad (personas), forma y cantidad. Total: <strong>{totalMesas} mesas</strong>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '50vh', overflowY: 'auto' }}>
        {local.map((item, i) => (
          <TipoMesaCard key={i} item={item} index={i} onChange={v => updateItem(i, v)} onRemove={() => removeItem(i)} />
        ))}
      </div>

      <button onClick={addItem} style={{
        width: '100%', padding: '10px', background: 'transparent', border: `1.5px dashed ${C.creamDeep}`,
        borderRadius: '12px', cursor: 'pointer', color: C.forest, fontSize: '12px', fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '12px',
      }}>
        <Plus size={14} /> Agregar nuevo tipo de mesa
      </button>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '11px', color: '#991b1b', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <button onClick={() => { onSave(local); onClose(); }} style={{
        width: '100%', padding: '14px',
        background: C.forest, border: 'none', borderRadius: '12px',
        cursor: 'pointer', color: C.cream, fontSize: '14px', fontWeight: 600,
      }}>Guardar configuración</button>
    </Overlay>
  );
}
