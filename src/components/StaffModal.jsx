import { useState } from 'react';
import { X, UserPlus, ToggleLeft, ToggleRight, Trash2, Grid, Plus } from 'lucide-react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { C, inp, getAssignedTables } from '../utils';
import { Overlay } from './ui';

const staffDoc = (id) => doc(db, 'staff', id);

export default function StaffModal({ staff, sectors, saveSectors, onClose }) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingTables, setEditingTables] = useState(null);
  const [editingNumbers, setEditingNumbers] = useState([]);
  const [numInput, setNumInput] = useState('');

  const addStaff = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = `s${Date.now()}`;
      await setDoc(staffDoc(id), { name, active: true, assignedTables: [], createdAt: serverTimestamp() });
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
      if (sectors && saveSectors) {
        const filtered = sectors.filter(sec => sec.name !== s.name);
        if (filtered.length !== sectors.length) {
          await saveSectors(filtered);
        }
      }
    } catch (e) { console.error(e); }
  };

  const openTableEditor = (s) => {
    setEditingTables(s);
    // Los IDs físicos legados (m13...) no son números elegidos: no se muestran.
    setEditingNumbers(getAssignedTables(s).map(String).filter(n => !/^m\d+$/i.test(n)));
    setNumInput('');
  };

  // Parsea entradas rápidas: "1,2,3,4,5", "1-8", "1..8", "1,3-5,7" o mezclas
  const parseNumbers = (input) => {
    const out = [];
    for (const tok of input.split(/[,\s]+/).filter(Boolean)) {
      const t = tok.trim().replace(/^m/i, '');
      const range = t.match(/^(\d+)\s*[-.]{1,2}\s*(\d+)$/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (a <= b && b - a < 500) {
          for (let n = a; n <= b; n++) out.push(String(n));
          continue;
        }
      }
      if (/^\d+$/.test(t)) out.push(t);
    }
    return out;
  };

  const addNumbers = () => {
    const parsed = parseNumbers(numInput);
    if (parsed.length === 0) return;
    setEditingNumbers(prev => {
      const seen = new Set(prev.map(n => String(n).replace(/^m/i, '')));
      const next = [...prev];
      for (const n of parsed) {
        if (!seen.has(n)) { seen.add(n); next.push(n); }
      }
      return next;
    });
    setNumInput('');
  };

  const removeNumber = (i) => {
    setEditingNumbers(prev => prev.filter((_, idx) => idx !== i));
  };

  const saveNumbers = async () => {
    if (!editingTables) return;
    const nums = editingNumbers
      .filter(n => String(n).trim() !== '')
      .filter(n => !/^m\d+$/i.test(String(n)));
    try {
      await setDoc(staffDoc(editingTables.id), { assignedTables: nums }, { merge: true });
      setEditingTables(null);
      setEditingNumbers([]);
      setNumInput('');
    } catch (e) { console.error(e); }
  };

  const getTableNames = (tableIds) => {
    if (!Array.isArray(tableIds) || tableIds.length === 0) return 'Sin mesas';
    return tableIds.map(n => String(n).replace(/^m/i, '')).join(', ');
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

        <p style={{ fontSize: '12px', color: C.muted, margin: '0 0 14px', lineHeight: 1.5 }}>
          Elegí libremente los números de mesa de {editingTables.name}. El plano se adapta:
          las mesas físicas de su sector adoptan estos números por posición.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            value={numInput}
            onChange={e => setNumInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNumbers(); }}
            placeholder="ej: 1,2,3,4,5 o 1-8"
            inputMode="text"
            style={{ ...inp, flex: 1 }}
          />
          <button onClick={addNumbers} style={{
            padding: '12px 16px', background: C.forest, border: 'none', borderRadius: '12px',
            cursor: 'pointer', color: C.cream, fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap',
          }}>
            <Plus size={14} /> Agregar
          </button>
        </div>
        <p style={{ fontSize: '11px', color: C.muted, margin: '-6px 0 14px', lineHeight: 1.5 }}>
          Escribí varios a la vez: <strong>1,2,3,4,5</strong> · rangos: <strong>1-8</strong> · o mezcla: <strong>1,3-5,7</strong>
        </p>

        {editingNumbers.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {editingNumbers.map((num, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: C.forest, color: C.cream, borderRadius: '10px',
                padding: '8px 10px', fontSize: '14px', fontWeight: 700,
              }}>
                <span>Mesa {String(num).replace(/^m/i, '')}</span>
                <button onClick={() => removeNumber(i)} style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', color: C.cream, padding: '2px 5px', fontSize: '11px',
                }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '20px', textAlign: 'center', color: C.muted, fontSize: '12px',
            background: C.creamDeep, borderRadius: '12px', marginBottom: '16px',
          }}>
            Sin números asignados
          </div>
        )}

        <button onClick={saveNumbers} style={{
          width: '100%', padding: '14px', background: C.forest, border: 'none',
          borderRadius: '12px', cursor: 'pointer', color: C.cream,
          fontSize: '14px', fontWeight: 600,
        }}>
          Guardar números
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
          const assignedTables = getAssignedTables(s);
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
