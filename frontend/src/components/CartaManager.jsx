import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Check, X, Upload, FileText, ArrowLeft } from 'lucide-react';
import { C } from '../utils';
import { Overlay } from './ui';
import { catalogApi } from '../services/api';
import { normalizeCatalogItem } from '../schemas/catalogSchema';
import { DEFAULT_ORG_ID } from '../config/businessTypes';
import { parseMenuText } from '../utils/menuParser';

const inp = {
  width: '100%', padding: '8px 10px', fontSize: '13px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '8px', color: C.espresso, outline: 'none', fontFamily: 'inherit',
};

const inpSmall = { ...inp, width: 'auto', flex: 1, padding: '6px 8px', fontSize: '12px' };

export default function CartaManager({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', category: '' });
  const [editForm, setEditForm] = useState({});
  // ── Importación ──
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [importProgress, setImportProgress] = useState(null); // {done, total}
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await catalogApi.getByOrganization(DEFAULT_ORG_ID);
        if (!cancelled) setItems((data || []).map(i => normalizeCatalogItem(i)));
      } catch (e) {
        console.warn('[CartaManager] Error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    const { data } = await catalogApi.getByOrganization(DEFAULT_ORG_ID);
    setItems((data || []).map(i => normalizeCatalogItem(i)));
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await catalogApi.create(DEFAULT_ORG_ID, {
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        categoryId: form.category.trim() || null,
        type: 'product',
        active: true,
      });
      setForm({ name: '', price: '', category: '' });
      setAdding(false);
      await refresh();
    } catch (e) {
      console.warn('[CartaManager] Error adding:', e);
    }
  };

  const handleUpdate = async (id) => {
    try {
      await catalogApi.update(id, {
        name: editForm.name,
        price: parseFloat(editForm.price) || 0,
        categoryId: editForm.category || null,
      });
      setEditingId(null);
      await refresh();
    } catch (e) {
      console.warn('[CartaManager] Error updating:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await catalogApi.delete(id);
      await refresh();
    } catch (e) {
      console.warn('[CartaManager] Error deleting:', e);
    }
  };

  // ── Importación de carta ──────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleParse = () => {
    setImportError('');
    const parsed = parseMenuText(importText).filter(p => p.name);
    setPreview(parsed);
    if (parsed.length === 0) {
      setImportError('No pude leer ningún plato. Probá con el formato del ejemplo.');
    }
  };

  const updatePreviewRow = (key, field, value) => {
    setPreview(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));
  };

  const removePreviewRow = (key) => {
    setPreview(prev => prev.filter(p => p.key !== key));
  };

  const handleImport = async () => {
    const rows = preview.filter(p => p.name.trim());
    if (rows.length === 0) return;
    setImportError('');
    setImportProgress({ done: 0, total: rows.length });
    try {
      if (replaceAll) {
        for (const it of items) {
          try { await catalogApi.delete(it.id); } catch { /* sigue */ }
        }
      }
      let done = 0;
      for (const row of rows) {
        try {
          await catalogApi.create(DEFAULT_ORG_ID, {
            name: row.name.trim(),
            price: parseFloat(row.price) || 0,
            categoryId: String(row.category || '').trim() || null,
            type: 'product',
            active: true,
          });
        } catch { /* sigue con el resto */ }
        done += 1;
        setImportProgress({ done, total: rows.length });
      }
      await refresh();
      setImporting(false);
      setImportText('');
      setPreview([]);
      setReplaceAll(false);
    } catch (e) {
      console.warn('[CartaManager] Error importing:', e);
      setImportError('Hubo un error importando. Probá de nuevo.');
    } finally {
      setImportProgress(null);
    }
  };

  const closeImport = () => {
    setImporting(false);
    setImportText('');
    setPreview([]);
    setReplaceAll(false);
    setImportError('');
    setImportProgress(null);
  };

  const categories = {};
  for (const item of items) {
    const cat = item.categoryId || 'Sin categoría';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  return (
    <Overlay onClose={onClose} maxWidth="500px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Carta / Menú</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>

      {importing ? (
        <div>
          <button onClick={closeImport} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '10px', fontFamily: 'inherit' }}>
            <ArrowLeft size={13} /> Volver a la carta
          </button>
          <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
            Pegá tu carta como texto (o subí un .txt/.csv) y la app la lee sola: detecta categorías y precios.
          </p>

          <div style={{ background: C.creamDeep, borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', fontSize: '11px', color: C.muted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: C.espresso }}>Ejemplo:</div>
            <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}>{'BEBIDAS\nCoca $2500\nAgua $1500\n\nPARRILLA\nVacío $18000\nChorizo $9000'}</div>
          </div>

          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={'Pegá tu carta acá...\n\nBEBIDAS\nCoca $2500\n...'}
            rows={7}
            style={{ ...inp, resize: 'vertical', marginBottom: '8px' }}
          />

          <input ref={fileRef} type="file" accept=".txt,.csv,.md" onChange={handleFile} style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '10px', background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '10px', cursor: 'pointer', color: C.espresso, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FileText size={14} /> Subir archivo
            </button>
            <button onClick={handleParse} disabled={!importText.trim()} style={{ flex: 1, padding: '10px', background: importText.trim() ? C.forest : C.creamDeep, border: 'none', borderRadius: '10px', cursor: importText.trim() ? 'pointer' : 'not-allowed', color: importText.trim() ? C.cream : C.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
              Leer carta
            </button>
          </div>

          {importError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '12px', color: '#991b1b', marginBottom: '10px' }}>
              {importError}
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.espresso, marginBottom: '6px' }}>
                Se leyeron {preview.length} platos — revisalos antes de importar:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', marginBottom: '10px' }}>
                {preview.map(p => (
                  <div key={p.key} style={{ display: 'flex', gap: '4px', alignItems: 'center', background: C.white, border: `1px solid ${C.creamDeep}`, borderRadius: '8px', padding: '6px' }}>
                    <input value={p.name} onChange={e => updatePreviewRow(p.key, 'name', e.target.value)} style={inpSmall} placeholder="Plato" />
                    <input value={p.price} onChange={e => updatePreviewRow(p.key, 'price', e.target.value)} style={{ ...inpSmall, maxWidth: '70px' }} placeholder="$" type="number" />
                    <input value={p.category} onChange={e => updatePreviewRow(p.key, 'category', e.target.value)} style={inpSmall} placeholder="Categoría" />
                    <button onClick={() => removePreviewRow(p.key)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e06060', padding: '2px' }}><X size={13} /></button>
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: C.espresso, marginBottom: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
                Reemplazar la carta actual (borra los platos cargados)
              </label>
              <button onClick={handleImport} disabled={importProgress !== null} style={{ width: '100%', padding: '12px', background: importProgress ? C.creamDeep : C.forest, border: 'none', borderRadius: '10px', cursor: importProgress ? 'not-allowed' : 'pointer', color: importProgress ? C.muted : C.cream, fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Upload size={14} />
                {importProgress ? `Importando ${importProgress.done} de ${importProgress.total}...` : `Importar ${preview.length} platos`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>

      <p style={{ fontSize: '11px', color: C.muted, marginBottom: '14px', lineHeight: 1.4 }}>
        Cargá los platos y bebidas de tu carta. Aparecerán en la pestaña <strong>Comandas</strong> para armar los pedidos de cada mesa.
      </p>

      {loading ? (
        <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '16px' }}>Cargando...</div>
      ) : items.length === 0 && !adding ? (
        <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '20px', background: C.creamDeep, borderRadius: '12px' }}>
          No hay platos cargados. Agregá platos para usar en Comandas.
        </div>
      ) : null}

      {Object.entries(categories).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: '6px' }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {catItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: C.white, borderRadius: '10px', padding: '8px 10px',
                border: `1px solid ${C.creamDeep}`,
              }}>
                {editingId === item.id ? (
                  <>
                    <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inpSmall} placeholder="Nombre" />
                    <input value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} style={{ ...inpSmall, maxWidth: '70px' }} placeholder="$" type="number" />
                    <input value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={inpSmall} placeholder="Categoría" />
                    <button onClick={() => handleUpdate(item.id)} style={{ background: C.forest, border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: C.cream }}><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: C.espresso }}>{item.name}</span>
                    {item.price > 0 && <span style={{ fontSize: '12px', color: C.muted }}>${item.price}</span>}
                    <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, price: String(item.price || ''), category: item.categoryId || '' }); }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: '2px' }}><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(item.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e06060', padding: '2px' }}><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', background: C.creamDeep, borderRadius: '10px', padding: '12px', border: `1px solid ${C.creamDeep}` }}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder="Nombre del plato o bebida" autoFocus />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inpSmall} placeholder="Precio $" type="number" />
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inpSmall} placeholder="Categoría (ej: Bebidas)" />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: '8px', background: C.forest, border: 'none', borderRadius: '8px', cursor: 'pointer', color: C.cream, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
              Guardar
            </button>
            <button onClick={() => { setAdding(false); setForm({ name: '', price: '', category: '' }); }} style={{ padding: '8px 12px', background: C.white, border: `1px solid ${C.creamDeep}`, borderRadius: '8px', cursor: 'pointer', color: C.muted, fontSize: '12px', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', marginTop: items.length > 0 ? '12px' : '0' }}>
          <button onClick={() => setAdding(true)} style={{
            flex: 1, padding: '10px', background: 'transparent', border: `1.5px dashed ${C.creamDeep}`,
            borderRadius: '10px', cursor: 'pointer', color: C.forest, fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit',
          }}>
            <Plus size={14} /> Agregar plato o bebida
          </button>
          <button onClick={() => { setImporting(true); setAdding(false); }} style={{
            flex: 1, padding: '10px', background: C.white, border: `1.5px solid ${C.creamDeep}`,
            borderRadius: '10px', cursor: 'pointer', color: C.espresso, fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit',
          }}>
            <Upload size={14} /> Importar carta
          </button>
        </div>
      )}
        </>
      )}
    </Overlay>
  );
}
