// App.js — Andi MVP (Producción)
// PWA de gestión de mesas con sincronización en tiempo real vía Firebase Firestore
// Incluye máquina de estados en vivo para mozos

import React, { useState, useCallback, useEffect } from 'react';
import VistaCliente from './components/VistaCliente';
import PinGate, { logoutStaff } from './components/PinGate';

const StaffDashboard = React.lazy(() => import('./components/StaffDashboard'));

// ═══════════════════════════════════════════════════════════════════════════════
// App Principal
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [staffMode, setStaffMode] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ── Detectar actualización de PWA ────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => setUpdateAvailable(true);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const handleUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  const handleStaffAccess = useCallback(() => {
    setStaffMode(true);
  }, []);

  const handleStaffExit = useCallback(() => {
    logoutStaff();
    setStaffMode(false);
  }, []);

  return (
    <>
      {updateAvailable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#7a3a1e', color: '#f5efe6', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          fontSize: '13px', fontWeight: 600, fontFamily: '"Manrope", system-ui, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          <span>Nueva versión disponible</span>
          <button onClick={handleUpdate} style={{
            background: '#f5efe6', color: '#7a3a1e', border: 'none', borderRadius: '8px',
            padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}>Actualizar</button>
        </div>
      )}

      {staffMode ? (
        <PinGate onBack={handleStaffExit}>
          <React.Suspense fallback={<LoadingSpinner />}>
            <StaffDashboard onLogout={handleStaffExit} />
          </React.Suspense>
        </PinGate>
      ) : (
        <VistaCliente onStaffAccess={handleStaffAccess} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LoadingSpinner
// ═══════════════════════════════════════════════════════════════════════════════
function LoadingSpinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5efe6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid #ebe3d5', borderTopColor: '#c4602f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: '#7a3a1e' }}>Cargando Andi...</p>
    </div>
  );
}
