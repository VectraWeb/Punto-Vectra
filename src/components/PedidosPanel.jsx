import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { C } from '../utils';
import { ShoppingCart, Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

const PEDIDO_ESTADOS = {
  pendiente:    { label: 'Pendiente',  color: C.soon,     icon: Clock },
  en_preparacion: { label: 'En preparación', color: C.terraSoft, icon: ShoppingCart },
  listo:        { label: 'Listo',      color: C.free,     icon: CheckCircle },
  entregado:    { label: 'Entregado',  color: C.forest,   icon: CheckCircle },
  cancelado:    { label: 'Cancelado',  color: '#b0b0b0',  icon: XCircle },
};

export default function PedidosPanel({ date, service }) {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const q = query(
      collection(db, 'reservations'),
      where('date', '==', date),
      where('source', '==', 'whatsapp_bot'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPedidos(data.filter(p => !service || p.service === service));
    }, (err) => console.error('[Pedidos] Firestore error:', err));
    return unsub;
  }, [date, service]);

  const filtered = filtro === 'todos'
    ? pedidos
    : pedidos.filter(p => (p.pedidoEstado || 'pendiente') === filtro);

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Filtros */}
      <div className="pedidos-filtros" style={{ display: 'flex', marginBottom: '12px' }}>
        {[
          ['todos', 'Todos'],
          ['pendiente', 'Pendiente'],
          ['en_preparacion', 'Prep.'],
          ['listo', 'Listo'],
          ['entregado', 'Entregado'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFiltro(key)} style={{
            flex: 1, padding: '6px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: filtro === key ? C.forest : C.creamDeep,
            color: filtro === key ? C.cream : C.muted,
            fontSize: '10px', fontWeight: 600, fontFamily: 'inherit',
            textAlign: 'center',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center', background: C.creamDeep,
          borderRadius: '14px', color: C.muted,
        }}>
          <ShoppingCart size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {filtro === 'todos' ? 'No hay pedidos del bot' : `Sin pedidos ${PEDIDO_ESTADOS[filtro]?.label.toLowerCase() || ''}`}
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
            Los pedidos del WhatsApp Bot aparecerán aquí
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(p => {
            const estado = p.pedidoEstado || 'pendiente';
            const estadoCfg = PEDIDO_ESTADOS[estado] || PEDIDO_ESTADOS.pendiente;
            const Icon = estadoCfg.icon;
            return (
              <div key={p.id} style={{
                background: C.white, borderRadius: '14px', padding: '14px',
                borderLeft: `4px solid ${estadoCfg.color}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.espresso }}>
                      {p.customerName || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                      {p.time} · {p.partySize || '?'} personas · Mesa {p.tableId?.replace('m', '') || '?'}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: estadoCfg.color + '18', color: estadoCfg.color,
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  }}>
                    <Icon size={12} />
                    {estadoCfg.label}
                  </div>
                </div>
                {p.notes && p.notes !== 'Reservado vía WhatsApp Bot' && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '6px',
                    background: C.creamDeep, borderRadius: '10px', padding: '10px',
                    marginTop: '4px',
                  }}>
                    <MessageCircle size={14} style={{ color: C.muted, flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: C.espresso, lineHeight: '1.4' }}>{p.notes}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {Object.entries(PEDIDO_ESTADOS).filter(([k]) => k !== estado).map(([key, cfg]) => (
                    <button key={key} onClick={() => updatePedidoEstado(p.id, key)} style={{
                      padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.creamDeep}`,
                      background: C.cream, cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                      color: C.espresso, fontFamily: 'inherit',
                    }}>
                      → {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function updatePedidoEstado(id, newEstado) {
  try {
    await updateDoc(doc(db, 'reservations', id), { pedidoEstado: newEstado });
  } catch (err) {
    console.error('[Pedidos] Error updating estado:', err);
  }
}
