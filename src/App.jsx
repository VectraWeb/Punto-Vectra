// App.js — Andi MVP (Producción)
// PWA de gestión de mesas con sincronización en tiempo real vía Firebase Firestore
// Incluye máquina de estados en vivo para mozos

import { useState, useCallback, useEffect } from 'react';
import VistaCliente from './components/VistaCliente';
import PinGate from './components/PinGate';
import StaffDashboard from './components/StaffDashboard';
import { C, logoutStaff } from './utils';

const VERSION_CHECK_INTERVAL = 60 * 1000; // 1 minuto

// ═══════════════════════════════════════════════════════════════════════════════
// App Principal
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [staffMode, setStaffMode] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ── Detectar nueva versión de PWA ────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Solo avisamos cuando hay un SW realmente más nuevo que el activo.
    // `controllerchange` NO sirve aquí: con autoUpdate + skipWaiting se
    // dispara en cada actualización automática y volvería a mostrar el banner
    // aunque ya estemos en la última versión.
    const watchedRegs = new WeakSet();
    const watchForUpdate = (reg) => {
      if (!reg || watchedRegs.has(reg)) return;
      watchedRegs.add(reg);
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW || !navigator.serviceWorker.controller) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed') setUpdateAvailable(true);
        });
      });
    };

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          watchForUpdate(reg);
          await reg.update();
        }
      } catch (e) {
        console.warn('[Andi] Error checking for updates:', e);
      }
    };

    const interval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

    // Verificar al inicio después de 10s
    const initialTimer = setTimeout(checkForUpdates, 10000);

    // Re-verificar cuando el usuario vuelve a la pestaña (crítico para iOS PWA)
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdates(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // ── Aplicar actualización: recargar (el SW nuevo ya está activo) ────────
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
      {/* ── BANNER DE ACTUALIZACIÓN ── */}
      {updateAvailable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: C.forest, color: C.cream,
          padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          fontSize: '13px', fontWeight: 600, fontFamily: '"Manrope", system-ui, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          <span>Nueva versión disponible</span>
          <button onClick={handleUpdate} style={{
            background: C.cream, color: C.forest, border: 'none', borderRadius: '8px',
            padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}>Actualizar</button>
        </div>
      )}

      {staffMode ? (
        <PinGate onBack={handleStaffExit}>
          <StaffDashboard onLogout={handleStaffExit} />
        </PinGate>
      ) : (
        <VistaCliente onStaffAccess={handleStaffAccess} />
      )}
    </>
  );
}
