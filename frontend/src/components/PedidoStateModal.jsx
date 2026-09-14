import { C, PEDIDO_ESTADOS } from '../utils';
import { Overlay } from './ui';

const OPCIONES = ['en_preparacion', 'listo', 'entregado', 'cancelado'];
const PRINCIPALES = ['listo', 'entregado'];

export default function PedidoStateModal({ pedido, onSelect, onClose }) {
  const estadoActual = pedido.pedidoEstado || 'pendiente';

  return (
    <Overlay onClose={onClose}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Cambiar estado del pedido</p>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {pedido.customerName || 'Sin nombre'}
        </h3>
        <p style={{ fontSize: '12px', color: C.muted, margin: '4px 0 0' }}>
          {pedido.time ? `${pedido.time} · ` : ''}
          {pedido.notes && pedido.notes !== 'Reservado vía WhatsApp Bot' ? pedido.notes.slice(0, 60) : 'Pedido'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {OPCIONES.map(key => {
          const cfg = PEDIDO_ESTADOS[key];
          const active = estadoActual === key;
          const principal = PRINCIPALES.includes(key);
          const Icon = cfg.icon;
          return (
            <button key={key} onClick={() => onSelect(key)} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: principal ? '18px 16px' : '14px 16px',
              borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${active || principal ? cfg.color : C.creamDeep}`,
              background: principal ? (active ? cfg.color : cfg.color + '22') : (active ? cfg.color : C.white),
              color: principal ? (active ? '#fff' : cfg.color) : (active ? '#fff' : C.espresso),
              fontWeight: principal ? 800 : (active ? 600 : 400),
              fontSize: principal ? '16px' : '14px',
            }}>
              {principal ? (
                <Icon size={20} strokeWidth={2.5} />
              ) : (
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              )}
              {cfg.label}
              {active && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                  actual
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={onClose} style={{
        width: '100%', padding: '12px', background: C.forest, border: 'none',
        borderRadius: '12px', cursor: 'pointer', color: C.cream,
        fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
      }}>
        Cerrar
      </button>
    </Overlay>
  );
}