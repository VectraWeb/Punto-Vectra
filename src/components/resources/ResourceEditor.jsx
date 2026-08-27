// ResourceEditor.jsx — Editor de recursos (crear, renombrar, capacidad, eliminar).
// La posición y el tamaño se editan desde el plano (ResourceMap). Los recursos
// creados acá son "manuales" (generated: false): el sync de config no los borra.

import { useState, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { C, SHAPE_KEYS, SHAPE_LABELS } from '../../utils';
import { Overlay } from '../ui';
import { useResources } from '../../hooks/useResources';
import { addResource, updateResource, deleteResource } from '../../services/resourceService';
import { resourceLabelOf, resourcePluralOf, resourceTypeOf } from '../../config/businessTypes';

const inp = {
  width: '100%', padding: '8px 10px', fontSize: '13px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '8px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

export default function ResourceEditor({ organization = null, onClose }) {
  const resources = useResources(null, organization);
  const resourceLabel = resourceLabelOf(organization);
  const resourcePlural = resourcePluralOf(organization);
  const resourceType = resourceTypeOf(organization);

  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');

  const nextNumber = useMemo(() => {
    const nums = resources.map(r => Number(r.number) || 0).filter(n => n > 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }, [resources]);

  const maxCapacity = 40;

  const handleAdd = async () => {
    setBusy(true);
    setError('');
    try {
      const id = resourceType === 'table' ? `m${nextNumber}` : `res${nextNumber}`;
      await addResource({
        id,
        name: `${resourceLabel} ${nextNumber}`,
        type: resourceType,
        capacity: 4,
        shape: SHAPE_KEYS.includes('redonda') ? 'redonda' : SHAPE_KEYS[0],
        number: nextNumber,
      }, { organization });
    } catch (e) {
      console.error('[ResourceEditor] Error creando recurso:', e);
      setError('No se pudo crear el recurso.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (r, patch) => {
    try {
      await updateResource(r.id, patch, { organization });
    } catch (e) {
      console.error('[ResourceEditor] Error actualizando recurso:', e);
      setError('No se pudo actualizar el recurso.');
    }
  };

  const handleDelete = async (r) => {
    setBusy(true);
    setError('');
    try {
      await deleteResource(r.id, { organization });
      setConfirmId(null);
    } catch (e) {
      console.error('[ResourceEditor] Error eliminando recurso:', e);
      setError('No se pudo eliminar el recurso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} maxWidth="560px">
      <style>{`.settings-scroll::-webkit-scrollbar { display: none; } .settings-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {resourcePlural}
        </h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}>
          <X size={18} />
        </button>
      </div>

      <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 12px', lineHeight: 1.4 }}>
        Creá, renombrá o cambiá la capacidad de tus {resourcePlural.toLowerCase()}. La posición se ajusta desde el plano.
      </p>

      <div className="settings-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', marginBottom: '12px' }}>
        {resources.map(r => (
          <div key={r.id} style={{ background: C.white, borderRadius: '12px', padding: '10px 12px', border: `1px solid ${C.creamDeep}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={r.name}
                onChange={e => handleUpdate(r, { name: e.target.value })}
                style={{ ...inp, fontWeight: 600, color: C.forest }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap' }}>
                  Capacidad
                </label>
                <input
                  type="number"
                  min={0}
                  max={maxCapacity}
                  value={r.capacity || 0}
                  onChange={e => handleUpdate(r, { capacity: Math.max(0, Math.min(maxCapacity, Number(e.target.value) || 0)) })}
                  style={{ ...inp, width: '70px', padding: '6px 8px' }}
                />
                {r.type === 'table' && (
                  <>
                    <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap' }}>
                      Forma
                    </label>
                    <select
                      value={r.shape}
                      onChange={e => handleUpdate(r, { shape: e.target.value })}
                      style={{ ...inp, width: 'auto', padding: '6px 8px' }}
                    >
                      {SHAPE_KEYS.map(k => <option key={k} value={k}>{SHAPE_LABELS[k]}</option>)}
                    </select>
                  </>
                )}
              </div>
            </div>
            {confirmId === r.id ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => handleDelete(r)} disabled={busy} style={{
                  padding: '8px 10px', background: '#e06060', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', color: '#fff', fontSize: '11px', fontWeight: 600,
                }}>Sí</button>
                <button onClick={() => setConfirmId(null)} style={{
                  padding: '8px 10px', background: C.creamDeep, border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '11px', color: C.muted,
                }}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmId(r.id)} title={`Eliminar ${resourceLabel.toLowerCase()}`} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: '#e06060',
                padding: '6px', flexShrink: 0, display: 'flex', alignItems: 'center',
              }}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '11px', color: '#991b1b', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <button onClick={handleAdd} disabled={busy} style={{
        width: '100%', padding: '12px', background: 'transparent',
        border: `1.5px dashed ${C.creamDeep}`, borderRadius: '12px', cursor: 'pointer',
        color: C.forest, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        <Plus size={15} /> Agregar {resourceLabel.toLowerCase()}
      </button>
    </Overlay>
  );
}
