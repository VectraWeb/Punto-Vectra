import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Minus, X } from 'lucide-react';
import { Printer } from 'lucide-react';
import { C } from '../utils';

function CategorySection({ cat, items, plates, onAdd, onRemove }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: C.muted, marginBottom: '6px', paddingBottom: '4px',
        borderBottom: `1px solid ${C.creamDeep}`,
      }}>{cat}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '5px' }}>
        {items.map(item => {
          const qty = plates.find(p => p.name === item.name)?.qty || 0;
          const selected = qty > 0;
          return (
            <div key={item.name} style={{ position: 'relative' }}>
              <button onClick={() => selected ? onRemove(item.name) : onAdd(item.name, 1)} style={{
                width: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                background: selected ? `${C.terra}18` : C.white,
                border: selected ? `2px solid ${C.terra}` : `1.5px solid ${C.creamDeep}`,
                borderRadius: '10px', padding: '8px 6px', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'center',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: C.espresso, lineHeight: 1.2 }}>{item.name}</span>
                {item.price > 0 && <span style={{ fontSize: '10px', color: C.muted }}>${item.price.toLocaleString('es-AR')}</span>}
              </button>
              {selected && (
                <div style={{
                  position: 'absolute', top: '-5px', right: '-5px',
                  display: 'flex', alignItems: 'center', gap: '0',
                }}>
                  <button onClick={(e) => { e.stopPropagation(); onRemove(item.name); }} style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: C.forest, color: '#fff', border: '2px solid ' + C.cream,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, lineHeight: 1, padding: 0,
                  }}>−</button>
                  <span style={{
                    background: C.terra, color: '#fff', borderRadius: '8px',
                    padding: '1px 6px', fontSize: '11px', fontWeight: 700,
                    minWidth: '18px', textAlign: 'center',
                  }}>{qty}</span>
                  <button onClick={(e) => { e.stopPropagation(); onAdd(item.name, 1); }} style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: C.terra, color: '#fff', border: '2px solid ' + C.cream,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, lineHeight: 1, padding: 0,
                  }}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComandasPanel({ reservations, tables, catalog = [], onSavePlates }) {
  const [comandas, setComandas] = useState(() => {
    const init = {};
    for (const r of reservations) {
      init[r.id] = r.plates || [];
    }
    return init;
  });
  const [selectedId, setSelectedId] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!saveTimer.current) return;
    const { resId, plates } = saveTimer.current;
    onSavePlates?.(resId, plates);
    saveTimer.current = null;
  }, [comandas]);

  const active = reservations.filter(r =>
    (r.tableId || r.resourceId) &&
    r.liveState !== 'finalizado' && r.liveState !== 'para_limpiar'
  );

  const selectedRes = active.find(r => r.id === selectedId) || null;

  const categories = {};
  for (const item of catalog) {
    const cat = (item.categoryId || item.category || 'Otros').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  const setPlateCount = useCallback((resId, plateName, delta) => {
    setComandas(prev => {
      const list = [...(prev[resId] || [])];
      const idx = list.findIndex(p => p.name === plateName);
      if (idx >= 0) {
        const newQty = (list[idx].qty || 0) + delta;
        if (newQty <= 0) list.splice(idx, 1);
        else list[idx] = { ...list[idx], qty: newQty };
      } else if (delta > 0) {
        list.push({ name: plateName, qty: delta });
      }
      saveTimer.current = { resId, plates: list };
      return { ...prev, [resId]: list };
    });
  }, []);

  const handleSelect = (resId) => {
    setSelectedId(resId);
  };

  const selectedPlates = selectedRes ? (comandas[selectedRes.id] || []) : [];
  const selectedTotal = selectedPlates.reduce((sum, p) => {
    const item = catalog.find(c => c.name === p.name);
    return sum + ((item?.price || 0) * (p.qty || 0));
  }, 0);

  const printTicket = () => {
    if (!selectedRes) return;
    const table = tables.find(t => t.id === (selectedRes.tableId || selectedRes.resourceId));
    const tableName = table?.name || selectedRes.mesa || 'Sin mesa';
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    let itemsHtml = selectedPlates.map(p => {
      const item = catalog.find(c => c.name === p.name);
      const price = item?.price || 0;
      const subtotal = price * p.qty;
      return `<div style="display:flex;justify-content:space-between;margin:4px 0;font-size:14px;">
        <span>${p.qty}× ${p.name}</span>
        <span>$${subtotal.toLocaleString('es-AR')}</span>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><title>Ticket</title>
<style>
  @media print { body { margin: 0; } }
  body { font-family: Arial, sans-serif; padding: 24px; max-width: 280px; margin: 0 auto; }
</style>
</head><body>
  <div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:18px;font-weight:700;margin-bottom:2px;">${tableName}</div>
    <div style="font-size:12px;color:#666;">Comanda</div>
  </div>
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="font-size:13px;margin-bottom:8px;">
    <div><b>Cliente:</b> ${selectedRes.customerName || '—'}</div>
    <div><b>Personas:</b> ${selectedRes.partySize || selectedRes.guests || '—'}</div>
    ${selectedRes.staffName ? `<div><b>Mozo:</b> ${selectedRes.staffName}</div>` : ''}
    ${selectedRes.phone ? `<div><b>Tel:</b> ${selectedRes.phone}</div>` : ''}
  </div>
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Platos:</div>
  ${itemsHtml}
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:8px;">
    <span>TOTAL</span>
    <span>$${selectedTotal.toLocaleString('es-AR')}</span>
  </div>
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="text-align:center;font-size:11px;color:#999;margin-top:12px;">
    ${fecha} ${hora}
  </div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };

  if (active.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px', margin: '0 16px' }}>
        No hay mesas activas para generar comandas
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', position: 'relative' }}>
      {/* Grilla de mesas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '10px',
        filter: selectedRes ? 'blur(2px) brightness(0.7)' : 'none',
        transition: 'filter 0.2s',
        pointerEvents: selectedRes ? 'none' : 'auto',
      }}>
        {active.map(r => {
          const table = tables.find(t => t.id === (r.tableId || r.resourceId));
          const tableName = table?.name || r.mesa || 'Sin mesa';
          const plates = comandas[r.id] || [];
          const totalPlates = plates.reduce((s, p) => s + (p.qty || 0), 0);
          const totalPrice = plates.reduce((sum, p) => {
            const item = catalog.find(c => c.name === p.name);
            return sum + ((item?.price || 0) * (p.qty || 0));
          }, 0);
          const hasPlates = plates.length > 0;
          const isSelected = selectedId === r.id;

          return (
            <button key={r.id} onClick={() => handleSelect(r.id)} style={{
              background: C.white, border: `2px solid ${isSelected ? C.terra : hasPlates ? `${C.terra}66` : C.creamDeep}`,
              borderRadius: '14px', padding: '14px', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              transition: 'transform 0.1s',
              display: 'flex', flexDirection: 'column', gap: '4px',
              minHeight: '90px',
            }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: '"Fraunces", serif', color: C.espresso }}>
                  {tableName}
                </div>
                {totalPlates > 0 && (
                  <span style={{
                    background: C.terra, color: '#fff', borderRadius: '8px',
                    padding: '2px 7px', fontSize: '11px', fontWeight: 700,
                  }}>${totalPrice > 0 ? totalPrice.toLocaleString('es-AR') : totalPlates}</span>
                )}
              </div>
              <div style={{ fontSize: '10px', color: C.muted, lineHeight: 1.3 }}>
                {r.customerName || '—'} · {r.partySize || r.guests || '?'}p
                {r.staffName && <> · {r.staffName}</>}
              </div>
              {hasPlates && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                  {plates.map(p => (
                    <span key={p.name} style={{
                      background: `${C.terra}12`, color: C.terra, borderRadius: '5px',
                      padding: '1px 5px', fontSize: '9px', fontWeight: 600,
                    }}>{p.qty}× {p.name}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel push desde abajo */}
      {selectedRes && (
        <>
          {/* Overlay */}
          <div onClick={() => setSelectedId(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 90, animation: 'fadeIn 0.15s ease-out',
          }} />

          {/* Modal centrado */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '94vw', maxWidth: '560px', maxHeight: '88vh',
            background: C.cream, borderRadius: '18px',
            zIndex: 100, display: 'flex', flexDirection: 'column',
            animation: 'modalPop 0.2s ease-out',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: `1px solid ${C.creamDeep}`, flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: '"Fraunces", serif', color: C.espresso }}>
                  {tables.find(t => t.id === (selectedRes.tableId || selectedRes.resourceId))?.name || selectedRes.mesa || 'Sin mesa'}
                </div>
                <div style={{ fontSize: '11px', color: C.muted }}>
                  {selectedRes.customerName} · {selectedRes.partySize || selectedRes.guests || '?'}p
                  {selectedRes.staffName && <> · {selectedRes.staffName}</>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selectedPlates.length > 0 && (
                  <button onClick={printTicket} style={{
                    background: C.creamDeep, border: 'none', borderRadius: '8px',
                    padding: '6px 10px', cursor: 'pointer', color: C.forest,
                    display: 'flex', alignItems: 'center',
                  }}>
                    <Printer size={16} />
                  </button>
                )}
                <button onClick={() => setSelectedId(null)} style={{
                  background: C.creamDeep, border: 'none', borderRadius: '8px',
                  padding: '6px 10px', cursor: 'pointer', color: C.forest,
                  display: 'flex', alignItems: 'center',
                }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenido scrolleable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {/* Platos seleccionados */}
              {selectedPlates.length > 0 && (
                <div style={{ padding: '10px 12px', background: '#f0f8ff', borderRadius: '10px', marginBottom: '10px', border: `1px solid ${C.creamDeep}` }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: '6px' }}>Seleccionados</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedPlates.map(p => (
                      <span key={p.name} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: C.forest, color: C.cream, borderRadius: '8px',
                        padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                      }}>
                        {p.qty}× {p.name}
                        <button onClick={() => setPlateCount(selectedRes.id, p.name, -1)}
                          style={{ background: 'none', border: 'none', color: C.cream, cursor: 'pointer', padding: 0, opacity: 0.7 }}>
                          <Minus size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Menú por categoría */}
              {Object.keys(categories).length === 0 ? (
                <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '20px', background: C.creamDeep, borderRadius: '12px' }}>
                  Cargá platos en Carta para usar comandas
                </div>
              ) : (
                Object.entries(categories).map(([cat, items]) => (
                  <CategorySection
                    key={cat}
                    cat={cat}
                    items={items}
                    plates={selectedPlates}
                    onAdd={(name) => setPlateCount(selectedRes.id, name, 1)}
                    onRemove={(name) => setPlateCount(selectedRes.id, name, -1)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop { from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>
    </div>
  );
}
