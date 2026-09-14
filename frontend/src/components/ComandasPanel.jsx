import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Printer } from 'lucide-react';
import { C } from '../utils';

function CategorySection({ cat, items, plates, onAdd, expanded, onToggle }) {
  const selectedCount = items.filter(item => plates.find(p => p.name === item.name)?.qty > 0).length;

  return (
    <div style={{ marginBottom: '6px' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', color: C.espresso,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedCount > 0 && (
            <span style={{ fontSize: '10px', color: C.terra, fontWeight: 600 }}>{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
          )}
          {expanded ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
        </div>
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingBottom: '4px' }}>
          {items.map(item => {
            const qty = plates.find(p => p.name === item.name)?.qty || 0;
            return (
              <button key={item.name} onClick={() => onAdd(item.name, 1)} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: qty > 0 ? `${C.terra}18` : C.creamDeep,
                border: qty > 0 ? `1.5px solid ${C.terra}` : '1.5px solid transparent',
                borderRadius: '10px', padding: '7px 10px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 500, color: C.espresso, fontFamily: 'inherit',
              }}>
                {item.name}
                {item.price > 0 && <span style={{ color: C.muted, fontSize: '10px' }}>${item.price}</span>}
                {qty > 0 && <span style={{ background: C.terra, color: '#fff', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{qty}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MesaComanda({ r, tables, catalog, comandas, setPlateCount }) {
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState(null);
  const table = tables.find(t => t.id === (r.tableId || r.resourceId));
  const tableName = table?.name || r.mesa || 'Sin mesa';
  const plates = comandas[r.id] || [];
  const totalPlates = plates.reduce((s, p) => s + (p.qty || 0), 0);

  const categories = {};
  for (const item of catalog) {
    const cat = (item.categoryId || item.category || 'Otros').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  const totalPrice = plates.reduce((sum, p) => {
    const item = catalog.find(c => c.name === p.name);
    return sum + ((item?.price || 0) * (p.qty || 0));
  }, 0);

  const handleAdd = useCallback((name, delta) => {
    setPlateCount(r.id, name, delta);
  }, [r.id, setPlateCount]);

  const printTicket = () => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    let itemsHtml = plates.map(p => {
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
    <div><b>Cliente:</b> ${r.customerName || '—'}</div>
    <div><b>Personas:</b> ${r.partySize || r.guests || '—'}</div>
    ${r.staffName ? `<div><b>Mozo:</b> ${r.staffName}</div>` : ''}
    ${r.phone ? `<div><b>Tel:</b> ${r.phone}</div>` : ''}
  </div>
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Platos:</div>
  ${itemsHtml}
  <hr style="border:none;border-top:2px dashed #ccc;margin:10px 0;">
  <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:8px;">
    <span>TOTAL</span>
    <span>$${totalPrice.toLocaleString('es-AR')}</span>
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

  return (
    <div style={{
      background: C.white, border: `1px solid ${C.creamDeep}`,
      borderRadius: '14px', overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '14px 16px', background: open ? C.forest : C.white,
        color: open ? C.cream : C.espresso, border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'inherit', textAlign: 'left',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: '"Fraunces", serif' }}>{tableName}</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>
            {r.customerName} · <Users size={10} style={{ display: 'inline' }} /> {r.partySize || r.guests || '—'}
            {r.staffName && <> · {r.staffName}</>}
          </div>
          {!open && plates.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {plates.map(p => (
                <span key={p.name} style={{
                  background: `${C.terra}18`, color: C.terra, borderRadius: '6px',
                  padding: '2px 8px', fontSize: '11px', fontWeight: 600,
                }}>{p.qty}× {p.name}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {totalPlates > 0 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); printTicket(); }} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
                padding: '4px 8px', cursor: 'pointer', color: open ? C.cream : C.forest,
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
                fontFamily: 'inherit',
              }}>
                <Printer size={16} />
              </button>
              <span style={{
                background: C.terra, color: '#fff', borderRadius: '8px',
                padding: '4px 10px', fontSize: '14px', fontWeight: 700,
                fontFamily: '"Fraunces", serif',
              }}>{totalPrice > 0 ? `$${totalPrice.toLocaleString('es-AR')}` : totalPlates}</span>
            </>
          )}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.creamDeep}` }}>
          {plates.length > 0 && (
            <div style={{ padding: '8px 10px', background: '#f0f8ff', borderRadius: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: '6px' }}>Seleccionados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {plates.map(p => (
                  <span key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: C.forest, color: C.cream, borderRadius: '8px',
                    padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                  }}>
                    {p.qty}× {p.name}
                    <button onClick={(e) => { e.stopPropagation(); setPlateCount(r.id, p.name, -1); }}
                      style={{ background: 'none', border: 'none', color: C.cream, cursor: 'pointer', padding: 0, opacity: 0.7 }}>
                      <Minus size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(categories).length === 0 ? (
            <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '12px' }}>
              Cargá platos en Carta para usar comandas
            </div>
          ) : (
            Object.entries(categories).map(([cat, items]) => (
              <CategorySection
                key={cat}
                cat={cat}
                items={items}
                plates={plates}
                onAdd={(name, delta) => handleAdd(name, delta)}
                expanded={openCat === cat}
                onToggle={() => setOpenCat(openCat === cat ? null : cat)}
              />
            ))
          )}
        </div>
      )}
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

  if (active.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.creamDeep, borderRadius: '14px', fontSize: '13px', margin: '0 16px' }}>
        No hay mesas activas para generar comandas
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {active.map(r => (
        <MesaComanda
          key={r.id}
          r={r}
          tables={tables}
          catalog={catalog}
          comandas={comandas}
          setPlateCount={setPlateCount}
        />
      ))}
    </div>
  );
}
