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
  const [showInstallGuide, setShowInstallGuide] = useState(false);

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
          background: C.forest, color: C.cream, padding: '12px 16px',
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

      {/* ── MODAL: GUÍA DE INSTALACIÓN (iOS / otros) ── */}
      {showInstallGuide && (
        <div onClick={() => setShowInstallGuide(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(31,58,46,0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200, padding: '16px',
          animation: 'overlayIn 0.2s ease-out',
        }}>
          <div onClick={e => e.stopPropagation()} className="modal-content" style={{
            background: C.cream, borderRadius: '24px',
            padding: '28px 24px 32px', width: '100%', maxWidth: '380px',
            animation: 'modalIn 0.25s ease-out',
          }}>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: '20px',
              fontStyle: 'italic', fontWeight: 600, color: C.forest,
              margin: '0 0 16px', textAlign: 'center',
            }}>
              Instalar Andi
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* iOS */}
              <div style={{ background: C.white, borderRadius: '14px', padding: '16px', border: `1px solid ${C.creamDeep}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>
                  iPhone / iPad (Safari)
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
                  <li>Tocá el botón <strong style={{ color: C.espresso }}>Compartir</strong> □↑ en Safari</li>
                  <li>Desplazá y tocá <strong style={{ color: C.espresso }}>Agregar a pantalla de inicio</strong></li>
                  <li>Tocá <strong style={{ color: C.espresso }}>Agregar</strong></li>
                </ol>
              </div>

              {/* Android */}
              <div style={{ background: C.white, borderRadius: '14px', padding: '16px', border: `1px solid ${C.creamDeep}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16V9h14V2H5l14 14h-7m-7 0l7 7v-7m-7 0h7"/></svg>
                  Android (Chrome)
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
                  <li>Tocá los <strong style={{ color: C.espresso }}>3 puntos</strong> ▤ del navegador</li>
                  <li>Tocá <strong style={{ color: C.espresso }}>Instalar app</strong> o <strong style={{ color: C.espresso }}>Agregar a pantalla principal</strong></li>
                </ol>
              </div>
            </div>

            <button onClick={() => setShowInstallGuide(false)} style={{
              width: '100%', marginTop: '20px', padding: '12px',
              background: C.forest, border: 'none', borderRadius: '12px',
              color: C.cream, fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
