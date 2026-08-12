import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { C } from '../utils';
import { Overlay } from './LiveStateModal';
import { inp, Field } from './ResModal';

export const SECTOR_COLORS = [
  '#7a3a1e', '#c4602f', '#6f8d4d', '#4a90d9', '#9b59b6',
  '#d4a04a', '#e67e22', '#2a1f1a', '#e09368', '#6b8e7b',
  '#7b1f2e', '#c49a35', '#455a64', '#00897b', '#5c6bc0',
];

export default function SectoresModal({ sectors, staff, onSave, onClose }) {
  const [list, setList] = useState([...sectors]);
  const [editingId, setEditingId] = useState(null);
  const editing = list.find(s => s.id === editingId) || null;

  const staffCount = (staff || []).filter(s => s.active !== false).length;
  const availableColors = SECTOR_COLORS.slice(0, Math.max(staffCount, 1));

  const addSector = () => {
    const id = `sec_${Date.now()}`;
    const newSector = {
      id,
      name: staff?.find(s => s.active !== false && !list.some(ls => ls.name === s.name))?.name || `Sector ${list.length + 1}`,
      color: availableColors[list.length % availableColors.length],
      x: 180 + list.length * 30, y: 60 + list.length * 30, w: 400, h: 250,
    };
    setList(prev => [...prev, newSector]);
    setEditingId(id);
  };

  const updateSector = (id, updates) => {
    setList(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSector = (id) => {
    setList(prev => prev.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleSave = () => {
    onSave(list);
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Sectores del salón</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>
      <p style={{ fontSize: '12px', color: C.muted, marginBottom: '16px', lineHeight: '1.5' }}>
        Creá un sector por cada mozo. Los colores se asignan automáticamente. Para posicionarlos, usá el botón "Sectores" en el plano.
      </p>

      <button onClick={addSector} style={{
        width: '100%', padding: '12px', background: C.forest, border: 'none', borderRadius: '12px',
        cursor: 'pointer', color: C.cream, fontSize: '13px', fontWeight: 600, marginBottom: '16px',
      }}>+ Agregar sector</button>

      {list.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px' }}>
          No hay sectores definidos
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: editing ? '16px' : 0 }}>
        {list.map(s => (
          <div key={s.id} onClick={() => setEditingId(editingId === s.id ? null : s.id)} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
            background: editingId === s.id ? `${s.color}22` : C.white,
            border: `1.5px solid ${editingId === s.id ? s.color : C.creamDeep}`,
            borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: s.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: C.espresso }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: C.muted }}>Toca para editar</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeSector(s.id); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#e06060', padding: '4px',
            }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ background: C.creamDeep, borderRadius: '14px', padding: '16px', marginTop: '4px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '10px' }}>Editando: {editing.name}</p>
          <Field label="Nombre">
            <input value={editing.name} onChange={e => updateSector(editing.id, { name: e.target.value })} style={inp} />
          </Field>
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '8px' }}>Color</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {availableColors.map(c => (
                <button key={c} onClick={() => updateSector(editing.id, { color: c })} style={{
                  width: '28px', height: '28px', borderRadius: '8px', background: c, border: editing.color === c ? `3px solid ${C.espresso}` : '3px solid transparent',
                  cursor: 'pointer', transition: 'border 0.1s',
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSave} style={{
        width: '100%', marginTop: '20px', padding: '14px',
        background: C.forest, border: 'none', borderRadius: '12px',
        cursor: 'pointer', color: C.cream, fontSize: '15px', fontWeight: 600,
      }}>Guardar sectores</button>
    </Overlay>
  );
}
