// VistaCliente.jsx — Vista pública: solo formulario de reserva
import React from 'react';
import ResForm from './ResForm';
import { C } from '../utils';

export default function VistaCliente({ onStaffAccess }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.cream, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
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
        Andi · Sistema de reservas · By VectraWeb
      </div>
    </div>
  );
}
