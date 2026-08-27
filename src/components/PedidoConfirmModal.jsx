import { useState } from 'react';
import { Minus, Plus, Clock } from 'lucide-react';
import { C } from '../utils';
import { Overlay } from './ui';

const PRESETS = [10, 15, 20, 30, 45, 60];
const MIN_MIN = 5;
const MAX_MIN = 180;
const STEP = 5;

const clamp = (n) => Math.min(MAX_MIN, Math.max(MIN_MIN, Math.round(n / STEP) * STEP));

const formatEta = (total) =>
  new Date(Date.now() + total * 60000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const stepperBtn = {
  width: '42px', height: '42px', borderRadius: '50%', border: 'none',
  background: C.creamDeep, color: C.espresso, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function TimeSelector({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '10px' }}>
        <button onClick={() => onChange(clamp(value - STEP))} style={stepperBtn} aria-label="Restar 5 minutos">
          <Minus size={16} />
        </button>
        <div style={{ fontSize: '30px', fontWeight: 800, color: C.espresso, minWidth: '70px', textAlign: 'center', fontFamily: '"Fraunces", serif', lineHeight: 1 }}>
          {value}
          <span style={{ fontSize: '13px', fontWeight: 600, color: C.muted, marginLeft: '3px' }}>min</span>
        </div>
        <button onClick={() => onChange(clamp(value + STEP))} style={stepperBtn} aria-label="Sumar 5 minutos">
          <Plus size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
        {PRESETS.map(min => (
          <button key={min} onClick={() => onChange(min)} style={{
            padding: '6px 12px', borderRadius: '20px',
            border: `1.5px solid ${value === min ? C.forest : C.creamDeep}`,
            background: value === min ? C.forest : C.white,
            color: value === min ? C.cream : C.espresso,
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {min}′
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PedidoConfirmModal({ pedido, onConfirm, onClose }) {
  const esEnvio = pedido.modalidad === 'envio';
  const [prep, setPrep] = useState(15);
  const [envio, setEnvio] = useState(esEnvio ? 15 : 0);
  const total = prep + envio;
  const eta = formatEta(total);

  return (
    <Overlay onClose={onClose}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Confirmar pedido</p>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {pedido.customerName || 'Sin nombre'}
        </h3>
        <p style={{ fontSize: '12px', color: C.muted, margin: '4px 0 0' }}>
          {pedido.time ? `${pedido.time} · ` : ''}
          {esEnvio ? (pedido.direccion ? `Envío a ${pedido.direccion}` : 'Envío a domicilio') : 'Retiro en el local'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '16px' }}>
        <TimeSelector label="Preparación" value={prep} onChange={setPrep} />
        {esEnvio && <TimeSelector label="Envío" value={envio} onChange={setEnvio} />}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        background: C.forest, borderRadius: '14px', padding: '14px 16px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.cream }}>
          <Clock size={18} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Tiempo estimado total</span>
        </div>
        <div style={{ color: C.cream, textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: '"Fraunces", serif', lineHeight: 1 }}>
            {total} min
          </div>
          <div style={{ fontSize: '11px', opacity: 0.85 }}>
            {esEnvio ? `Llegada ~${eta}` : `Listo ~${eta}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onConfirm({ prepMin: prep, envioMin: envio, totalMin: total })} style={{
          flex: 1, padding: '13px', background: C.forest, border: 'none',
          borderRadius: '12px', cursor: 'pointer', color: C.cream,
          fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
        }}>
          Confirmar y avisar al cliente
        </button>
        <button onClick={onClose} style={{
          padding: '13px 18px', background: C.creamDeep, border: 'none',
          borderRadius: '12px', cursor: 'pointer', color: C.muted,
          fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
        }}>
          Cancelar
        </button>
      </div>
    </Overlay>
  );
}
