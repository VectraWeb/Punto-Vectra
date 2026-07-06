// VistaCliente.jsx — Vista pública: solo formulario de reserva
import React from 'react';
import ResForm from './ResForm';

const C = {
  cream: '#f5efe6',
  forest: '#7a3a1e',
  muted: '#8b7d6b',
};

export default function VistaCliente({ onStaffAccess }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.cream, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Manrope:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
        button { transition: transform 0.1s; }
        button:active { transform: scale(0.97); }
      `}</style>

      {/* Fondo decorativo completo */}
      <div style={{
        position: 'fixed', inset: 0,
        background: `linear-gradient(180deg, ${C.forest}14 0%, transparent 40%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px' }}>
        <ResForm onStaffAccess={onStaffAccess} />
      </div>

      {/* Footer sutil */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        textAlign: 'center', padding: '12px',
        fontSize: '10px', color: C.muted, opacity: 0.5,
      }}>
        Andi · Sistema de reservas
      </div>
    </div>
  );
}
