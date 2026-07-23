// VistaCliente.jsx — Vista pública: solo formulario de reserva
import React from 'react';
import ResForm from './ResForm';
import { C } from '../utils';

export default function VistaCliente({ onStaffAccess, canInstall, onInstall }) {
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

      {/* Footer con botón instalar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px 16px 12px', gap: '6px',
        background: `linear-gradient(0deg, ${C.cream} 60%, transparent)`,
      }}>
        <button onClick={onInstall} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '20px',
          background: C.forest, color: C.cream,
          border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
          boxShadow: '0 2px 8px rgba(122,58,30,0.25)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {canInstall ? 'Instalar app' : 'Descargar app'}
        </button>
        <span style={{ fontSize: '10px', color: C.muted, opacity: 0.5 }}>
          Andi · Sistema de reservas · By VectraWeb
        </span>
      </div>
    </div>
  );
}
