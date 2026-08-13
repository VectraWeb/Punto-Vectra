import React, { useState } from 'react';
import { X, UserPlus, ToggleLeft, ToggleRight, Trash2, Grid } from 'lucide-react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { C } from '../utils';
import { Overlay } from './LiveStateModal';
import { inp } from './ResModal';

const staffDoc = (id) => doc(db, 'staff', id);

const DEFAULT_ASSIGNMENTS = {
  leo: [60,61,62,63,64,65,66,67,68,69,160,161,162,163,164],
  mica: [51,52,53,54,55,56,57,58,59,150,151,152,153,154],
  mauro: [40,41,42,43,44,45,46,47,48,49,140,141,142,143,144],
  rosanna: [20,21,22,23,24,25,26,27,28,29,120,121,122,123,124],
  jota: [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
  miguel: [30,31,32,33,34,35,36,37,38,39,130,131,132,133,134],
};

function getDefaultTables(name) {
  if (!name) return [];
  const lower = name.toLowerCase().trim();
  const nums = DEFAULT_ASSIGNMENTS[lower];
  if (!nums) return [];
  return nums.map(n => `m${n}`);
}

export default function StaffModal({ staff, tables, onClose }) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingTables, setEditingTables] = useState(null);
  const [tableInput, setTableInput] = useState('');

  const addStaff = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = `s${Date.now()}`;
      const assignedTables = getDefaultTables(name);
      await setDoc(staffDoc(id), { name, active: true, assignedTables, createdAt: serverTimestamp() });
      setNewName('');
    } catch (e) { console.error(e); }
  };

  const toggleActive = async (s) => {
    try {
      await setDoc(staffDoc(s.id), { active: s.active === false ? true : false }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const removeStaff = async (s) => {
    try {
      await deleteDoc(staffDoc(s.id));
    } catch (e) { console.error(e); }
  };

  const openTableEditor = (s) => {
    setEditingTables(s);
    const arr = Array.isArray(s.assignedTables) ? s.assignedTables : [];
    setTableInput(arr.map(id => id.replace('m', '')).join(', '));
  };

  const saveTables = async () => {
    if (!editingTables) return;
    const nums = tableInput
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s !== '' && !isNaN(s));
    const tableIds = nums.map(n => `m${n}`);
    try {
      await setDoc(staffDoc(editingTables.id), { assignedTables: tableIds }, { merge: true });
      setEditingTables(null);
      setTableInput('');
    } catch (e) { console.error(e); }
  };

  const getTableNames = (tableIds) => {
    if (!Array.isArray(tableIds) || tableIds.length === 0) return 'Sin mesas';
    if (!Array.isArray(tables)) return tableIds.map(id => id.replace('m', '')).join(', ');
    return tableIds.map(id => {
      const t = tables.find(tb => tb.id === id);
      return t ? t.name.replace('M', '') : id.replace('m', '');
    }).join(', ');
  };

  if (editingTables) {
    return (
      <Overlay onClose={() => setEditingTables(null)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setEditingTables(null)} style={{
            background: C.creamDeep, border: 'none', borderRadius: '10px',
            padding: '8px', cursor: 'pointer', color: C.muted,
          }}>
            <X size={18} />
          </button>
          <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
            Mesas de {editingTables.name}
          </h3>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>
            Números de mesa (separados por coma)
          </label>
          <input
            value={tableInput}
            onChange={e => setTableInput(e.target.value)}
            placeholder="Ej: 1, 2, 3, 4, 5"
            style={inp}
            autoFocus
          />
        </div>

        {Array.isArray(tables) && tables.length > 0 && (
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: '16px', background: C.creamDeep, borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: C.espresso }}>Mesas disponibles:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tables.map(t => (
                <span key={t.id} style={{
                  background: C.white, border: `1px solid ${C.creamDeep}`,
                  borderRadius: '6px', padding: '2px 6px', fontSize: '10px',
                }}>
                  {t.name.replace('M', '')}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={saveTables} style={{
          width: '100%', padding: '14px', background: C.forest, border: 'none',
          borderRadius: '12px', cursor: 'pointer', color: C.cream,
          fontSize: '14px', fontWeight: 600,
        }}>
          Guardar mesas
        </button>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Mozos</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStaff()}
          placeholder="Nombre del mozo"
          style={{ ...inp, flex: 1 }}
        />
        <button onClick={addStaff} style={{
          padding: '12px 16px', background: C.forest, border: 'none', borderRadius: '12px',
          cursor: 'pointer', color: C.cream, fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap',
        }}>
          <UserPlus size={14} /> Agregar
        </button>
      </div>

      {(!staff || staff.length === 0) && (
        <div style={{ padding: '24px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px' }}>
          No hay mozos cargados
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(staff || []).map(s => {
          const isActive = s.active !== false;
          const assignedTables = Array.isArray(s.assignedTables) ? s.assignedTables : [];
          return (
            <div key={s.id} style={{
              padding: '12px 14px',
              background: C.white, border: `1.5px solid ${isActive ? C.creamDeep : '#e0d0c0'}`,
              borderRadius: '12px', opacity: isActive ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isActive ? C.forest : C.creamDeep,
                  color: isActive ? C.cream : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 600, flexShrink: 0,
                }}>
                  {s.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: C.espresso }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: isActive ? C.free : C.muted }}>
                    {isActive ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <button onClick={() => openTableEditor(s)} title="Asignar mesas" style={{
                  background: assignedTables.length > 0 ? C.forestSoft : C.creamDeep,
                  border: 'none', borderRadius: '8px', padding: '6px 8px',
                  cursor: 'pointer', color: assignedTables.length > 0 ? C.white : C.muted,
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
                }}>
                  <Grid size={14} />
                  {assignedTables.length > 0 ? assignedTables.length : ''}
                </button>
                <button onClick={() => toggleActive(s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: isActive ? C.free : C.muted, padding: '4px',
                }}>
                  {isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                {confirmDeleteId === s.id ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button onClick={() => { removeStaff(s); setConfirmDeleteId(null); }} style={{
                      padding: '6px 10px', background: '#e06060', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '11px', fontWeight: 600,
                    }}>Sí</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{
                      padding: '6px 10px', background: C.creamDeep, border: 'none',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: C.muted,
                    }}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(s.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#e06060', padding: '4px',
                  }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {assignedTables.length > 0 && (
                <div style={{
                  marginTop: '8px', paddingTop: '8px',
                  borderTop: `1px solid ${C.creamDeep}`,
                  fontSize: '11px', color: C.muted,
                  display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
                }}>
                  <Grid size={10} />
                  <span style={{ fontWeight: 600 }}>Mesas:</span>
                  {getTableNames(assignedTables)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
