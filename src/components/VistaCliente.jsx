// VistaCliente.jsx — Vista pública: selector de Reserva / Pedido
import { useState, useRef, useCallback } from 'react';
import { Calendar, ShoppingBag } from 'lucide-react';
import ResForm from './ResForm';
import PedidoForm from './PedidoForm';
import { C } from '../utils';

export default function VistaCliente({ onStaffAccess }) {
  const [mode, setMode] = useState(null); // null = selector inicial

  // ── Triple clic en logo → acceso staff ──────────────────────────────────
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const handleLogoClicks = useCallback(() => {
    clickCount.current += 1;
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (onStaffAccess) onStaffAccess();
      return;
    }
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 1500);
  }, [onStaffAccess]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.cream, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>

      {/* Fondo decorativo completo */}
      <div style={{
        position: 'fixed', inset: 0,
        background: `linear-gradient(180deg, ${C.forest}14 0%, transparent 40%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px' }}>
        {mode === 'reserva' ? (
          <ResForm onBack={() => { window.scrollTo(0, 0); setMode(null); }} onStaffAccess={onStaffAccess} />
        ) : mode === 'pedido' ? (
          <PedidoForm onBack={() => { window.scrollTo(0, 0); setMode(null); }} onStaffAccess={onStaffAccess} />
        ) : (
          <div style={{ padding: '0 0 40px' }}>
            {/* Header branding */}
            <div style={{ padding: '40px 24px 28px', textAlign: 'center' }}>
              <h1 onClick={handleLogoClicks} style={{ fontFamily: '"Fraunces", serif', fontSize: '36px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0, lineHeight: 1, cursor: 'default', userSelect: 'none' }}>
                Andi
              </h1>
              <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                ¿Qué querés hacer?
              </p>
            </div>

            {/* Opciones */}
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button onClick={() => setMode('reserva')} style={{
                width: '100%', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px',
                background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '16px',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.terra; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.creamDeep; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: `${C.terra}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Calendar size={22} color={C.terra} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: C.espresso }}>Reservar mesa</div>
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Elegí fecha, horario y comensales</div>
                </div>
              </button>

              <button onClick={() => setMode('pedido')} style={{
                width: '100%', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px',
                background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '16px',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.creamDeep; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: `${C.forest}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingBag size={22} color={C.forest} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: C.espresso }}>Hacer un pedido</div>
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Contanos qué querés y lo preparamos</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer sutil */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        textAlign: 'center', padding: '12px',
        fontSize: '10px', color: C.muted, opacity: 0.5,
      }}>
        Andi · Sistema de reservas · By VectraWeb
      </div>
    </div>
  );
}