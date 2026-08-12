import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { C } from '../utils';
import { Overlay } from './LiveStateModal';

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

export const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
};

export default function ResModal({ editing, preTable, tables, slots, service, tableStatus, staff, onSave, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => editing ? { ...editing } : {
    customerName: '', phone: '', partySize: 2,
    tableId: preTable?.id || '',
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    staffId: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedTable = tables.find(t => t.id === form.tableId);
  const valid = form.customerName.trim() && form.time && form.partySize > 0;

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {editing ? 'Editar reserva' : 'Nueva reserva'}
        </h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
            placeholder="Nombre del cliente" style={inp} autoFocus />
        </Field>

        <Field label="Teléfono (opcional)">
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="+54 9 11 ..." type="tel" style={inp} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Comensales">
            <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} personas</option>)}
            </select>
          </Field>
          <Field label="Mesa">
            <select value={form.tableId} onChange={e => set('tableId', e.target.value)} style={inp}>
              <option value="">— elegir —</option>
               {tables.filter(t => {
                  const s = tableStatus(t.id);
                  const isCurrentRes = editing && editing.tableId === t.id;
                  return (s.status === 'free' || s.status === 'soon' || isCurrentRes) && t.capacity >= form.partySize;
                }).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <Field label="Horario">
            <input type="time" value={form.time} onChange={e => set('time', e.target.value)} style={inp} />
          </Field>
        </div>

        {staff.length > 0 && (
          <Field label="Mozo asignado">
            <select value={form.staffId} onChange={e => set('staffId', e.target.value)} style={inp}>
              <option value="">— sin asignar —</option>
              {staff.filter(s => s.active !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Notas (opcional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Alergias, pedidos especiales..." rows={2}
            style={{ ...inp, resize: 'vertical' }} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {editing && (
          confirmDelete ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#e06060', fontWeight: 600 }}>¿Eliminar?</span>
              <button onClick={() => onDelete(editing)} style={{
                padding: '10px 14px', background: '#e06060', border: 'none',
                borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: 600,
              }}>Sí</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '10px 14px', background: C.creamDeep, border: 'none',
                borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: C.muted,
              }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              padding: '14px', background: 'transparent', border: `1.5px solid #e06060`,
              borderRadius: '12px', cursor: 'pointer', color: '#e06060',
            }}>
              <Trash2 size={18} />
            </button>
          )
        )}
        <button onClick={() => {
          if (!valid) return;
          const staffMember = staff.find(s => s.id === form.staffId);
          onSave({ ...form, service, staffName: staffMember?.name || '' });
        }} style={{
          flex: 1, padding: '14px', background: valid ? C.terra : C.creamDeep,
          border: 'none', borderRadius: '12px', cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? C.white : C.muted, fontSize: '15px', fontWeight: 600,
        }}>
          {editing ? 'Guardar cambios' : 'Confirmar reserva'}
        </button>
      </div>
    </Overlay>
  );
}
