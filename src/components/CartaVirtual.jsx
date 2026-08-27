// CartaVirtual.jsx — Carta del restaurante renderizada nativa (sin iframe)
import { useState, useEffect } from 'react';
import {
  Wine, UtensilsCrossed, Sandwich, Croissant, Droplets, Drumstick,
  Fish, Salad, IceCreamBowl, CupSoda, ShoppingBag, Wifi, Sparkles, Leaf,
  ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { C } from '../utils';
import { CARTA, CARTA_HEADER, SUGERENCIAS } from '../carta';
import { fetchCarta } from '../services/cartaFetcher';

const ICONS = { Wine, UtensilsCrossed, Sandwich, Croissant, Droplets, Drumstick, Fish, Salad, IceCreamBowl, CupSoda, ShoppingBag, Wifi };

const fmtPrecio = (n) => `$${Number(n).toLocaleString('es-AR')}`;

const Badge = ({ children, color }) => (
  <span style={{
    display: 'inline-block', color: '#fff', fontSize: '9px', padding: '1px 5px',
    borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase',
    background: color, marginLeft: '6px', verticalAlign: 'middle', letterSpacing: '0.03em',
  }}>
    {children}
  </span>
);

function Item({ item, onAdd }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', borderBottom: '1px solid #dde2e6',
      padding: '10px 0', fontSize: '14px', textAlign: 'left',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
        <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 600, fontSize: '15px', lineHeight: 1.35, color: C.espresso, display: 'flex', alignItems: 'center', flex: '1 1 auto' }}>
          {item.name}
          {item.veggie && <Badge color="#4CAF50"><Leaf size={8} style={{ verticalAlign: 'middle', marginRight: '2px' }} />Veggie</Badge>}
          {item.sugerido && <Badge color="#800000">Sugerido</Badge>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: '"Fraunces", serif', fontSize: '15px', fontWeight: 700, color: C.forest, whiteSpace: 'nowrap' }}>
            {fmtPrecio(item.price)}
          </span>
          {onAdd && (
            <button type="button" aria-label={`Agregar ${item.name}`} onClick={() => onAdd(item)} style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: C.terra, color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: '0',
            }}>
              <Plus size={15} />
            </button>
          )}
        </span>
      </div>
      {item.desc && (
        <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#444', margin: '3px 0 0', fontFamily: 'inherit' }}>
          {item.desc}
        </p>
      )}
    </div>
  );
}

function Group({ title, items, onAdd }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      {title && (
        <h4 style={{ fontFamily: '"Fraunces", serif', fontSize: '17px', fontWeight: 700, color: '#8a4b20', margin: '0 0 4px' }}>
          {title}
        </h4>
      )}
      {items.map((item, i) => <Item key={i} item={item} onAdd={onAdd} />)}
    </div>
  );
}

export default function CartaVirtual({ onAddItem }) {
  const [openSections, setOpenSections] = useState({});
  const [carta, setCarta] = useState({ CARTA, SUGERENCIAS });
  const [fresh, setFresh] = useState(false);

  // Carta actualizada desde el sitio (fallback a la local si falla)
  useEffect(() => {
    let cancelled = false;
    fetchCarta().then(d => {
      if (cancelled || !d) return;
      setCarta(d);
      setFresh(true);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleSection = (title) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div style={{
      background: '#edf1f5', borderRadius: '14px', padding: '16px 14px',
      maxHeight: '55vh', minHeight: '320px', overflowY: 'auto',
      border: `1.5px solid ${C.creamDeep}`,
    }}>
      {/* Información del local */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {CARTA_HEADER.map((h, i) => {
          const Icon = ICONS[h.icon];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#444', background: '#fff', borderRadius: '10px', padding: '8px 10px' }}>
              {Icon && <Icon size={14} color={C.terra} style={{ flexShrink: 0 }} />}
              {h.text}
            </div>
          );
        })}
        {fresh && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b8f71', padding: '4px 2px' }}>
            ✓ Actualizada automáticamente desde nuestro sitio
          </div>
        )}
      </div>

      {/* Hoy sugerimos */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '18px', fontWeight: 700, color: C.espresso, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#800000" /> Hoy sugerimos
        </h3>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '6px 12px' }}>
          {carta.SUGERENCIAS.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < carta.SUGERENCIAS.length - 1 ? '1px solid #e8ecef' : 'none', fontSize: '13px' }}>
              <span style={{ color: C.espresso, lineHeight: 1.4, flex: 1 }}>{s.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ color: '#800000', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: '"Fraunces", serif' }}>{fmtPrecio(s.price)}</span>
                {onAddItem && (
                  <button type="button" aria-label={`Agregar ${s.name}`} onClick={() => onAddItem(s)} style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: C.terra, color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, padding: '0',
                  }}>
                    <Plus size={14} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Secciones desplegables */}
      {carta.CARTA.map((sec, i) => {
        const Icon = ICONS[sec.icon] || UtensilsCrossed;
        const open = !!openSections[sec.title];
        return (
          <div key={i} style={{ marginBottom: '8px', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid #dde2e6` }}>
            <button onClick={() => toggleSection(sec.title)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              background: open ? '#f5f7f9' : 'transparent',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon size={17} color={C.terra} />
                <span style={{ fontFamily: '"Fraunces", serif', fontSize: '17px', fontStyle: 'italic', fontWeight: 700, color: open ? C.forest : C.espresso }}>
                  {sec.title}
                </span>
              </span>
              {open ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
            </button>

            {open && (
              <div style={{ padding: '2px 14px 12px' }}>
                {sec.groups
                  ? sec.groups.map((g, gi) => <Group key={gi} title={g.title} items={g.items} onAdd={onAddItem} />)
                  : <Group items={sec.items} onAdd={onAddItem} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}