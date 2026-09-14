import { useState } from 'react';
import { X, UserPlus, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react';
import { staffApi } from '../services/api';
import { C, inp } from '../utils';
import { Overlay } from './ui';

export default function StaffModal({ staff, sectors, saveSectors, onStaffChange, onClose }) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');

  const addStaff = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await staffApi.create('default', { name, active: true, assignedTables: [] });
      setNewName('');
      if (onStaffChange) onStaffChange();
    } catch (e) { console.error(e); }
  };

  const toggleActive = async (s) => {
    try {
      await staffApi.update(s.id, { active: s.active === false ? true : false });
      if (onStaffChange) onStaffChange();
    } catch (e) { console.error(e); }
  };

  const removeStaff = async (s) => {
    try {
      await staffApi.delete(s.id);
      if (sectors && saveSectors) {
        const filtered = sectors.filter(sec => sec.name !== s.name);
        if (filtered.length !== sectors.length) {
          await saveSectors(filtered);
        }
      }
      if (onStaffChange) onStaffChange();
    } catch (e) { console.error(e); }
  };

  const renameStaff = async (s) => {
    const name = editNameValue.trim();
    if (!name) return;
    try {
      await staffApi.update(s.id, { name });
      setEditingName(null);
      if (onStaffChange) onStaffChange();
    } catch (e) { console.error(e); }
  };

  const startEditName = (s) => {
    setEditingName(s.id);
    setEditNameValue(s.name || '');
    setConfirmDeleteId(null);
  };

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
                {editingName === s.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
                    <input
                      value={editNameValue}
                      onChange={e => setEditNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameStaff(s); if (e.key === 'Escape') setEditingName(null); }}
                      autoFocus
                      style={inp}
                    />
                    <button onClick={() => renameStaff(s)} style={{
                      padding: '6px 10px', background: C.forest, border: 'none',
                      borderRadius: '8px', cursor: 'pointer', color: C.cream, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>Guardar</button>
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: C.espresso }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: isActive ? C.free : C.muted }}>
                      {isActive ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                )}
                {editingName !== s.id && (
                  <>
                    <button onClick={() => startEditName(s)} title="Editar nombre" style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px',
                    }}>
                      <Pencil size={15} />
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
