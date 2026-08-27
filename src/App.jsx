// App.js — Andi (Producción)
// PWA de gestión de reservas multi-negocio con sincronización en tiempo real
// vía Firebase Firestore. Acceso staff con cuenta propia (email + contraseña).

import { useState, useCallback, useEffect } from 'react';
import VistaCliente from './components/VistaCliente';
import StaffDashboard from './components/StaffDashboard';
import LoginScreen from './components/auth/LoginScreen';
import OnboardingScreen from './components/auth/OnboardingScreen';
import { C } from './utils';
import { useAuth } from './hooks/useAuth';
import {
  fetchUserOrganization,
  claimDefaultOrganization,
  signOutUser,
  signInAnonymous,
} from './services/authService';
import { DEFAULT_ORG_ID } from './config/businessTypes';

const VERSION_CHECK_INTERVAL = 60 * 1000; // 1 minuto

// ═══════════════════════════════════════════════════════════════════════════════
// Pantalla de reclamo: cuenta sin negocio vinculado
// ═══════════════════════════════════════════════════════════════════════════════
function ClaimScreen({ user, onDone, onGoRegister }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await claimDefaultOrganization(user.uid, user.email || '');
      onDone(res);
    } catch (err) {
      console.error('[ClaimScreen] Error:', err);
      setError(err.message || 'No se pudo reclamar la cuenta.');
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.cream, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 20px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '26px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0 }}>
          Tu cuenta no tiene negocio
        </h1>
        <p style={{ fontSize: '13px', color: C.muted, margin: '10px 0 24px', lineHeight: 1.5 }}>
          Podés crear un negocio nuevo desde cero o reclamar la cuenta existente de Andi (el restaurante actual) si sos el dueño.
        </p>
        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b', marginBottom: '14px' }}>
            {error}
          </div>
        )}
        <button onClick={onGoRegister} style={{
          width: '100%', padding: '14px', background: C.terra, border: 'none', borderRadius: '12px',
          cursor: 'pointer', color: '#fff', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', marginBottom: '10px',
        }}>
          Crear negocio nuevo
        </button>
        <button onClick={handleClaim} disabled={busy} style={{
          width: '100%', padding: '14px', background: C.white, border: `1.5px solid ${C.forest}`,
          borderRadius: '12px', cursor: 'pointer', color: C.forest, fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
        }}>
          {busy ? 'Reclamando...' : 'Reclamar la cuenta existente de Andi'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Raíz del panel staff: login → organización → dashboard
// ═══════════════════════════════════════════════════════════════════════════════
function StaffRoot({ onExit }) {
  const { user, initializing } = useAuth();
  const [access, setAccess] = useState(null); // { organizationId, organization }
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState('login'); // login | register

  const isStaffUser = user && !user.isAnonymous;

  // Resolver la organización del usuario autenticado.
  useEffect(() => {
    if (!isStaffUser) return undefined;
    let cancelled = false;
    fetchUserOrganization(user.uid)
      .then(res => { if (!cancelled) setAccess(res); })
      .catch(() => { if (!cancelled) setAccess(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user ? user.uid : null, user ? user.isAnonymous : false]);

  if (initializing || (isStaffUser && checking)) {
    return (
      <div style={{
        minHeight: '100vh', background: C.cream, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: '"Manrope", system-ui, sans-serif',
      }}>
        <div style={{
          fontFamily: '"Fraunces", serif', fontSize: '28px', fontStyle: 'italic',
          fontWeight: 700, color: C.forest,
        }}>Andi</div>
      </div>
    );
  }

  if (!isStaffUser) {
    if (mode === 'register') {
      return <OnboardingScreen onBack={() => setMode('login')} onDone={setAccess} />;
    }
    return <LoginScreen onBack={onExit} onGoRegister={() => setMode('register')} />;
  }

  if (!access) {
    if (mode === 'register') {
      return (
        <OnboardingScreen
          uid={user.uid}
          email={user.email || ''}
          onBack={() => setMode('login')}
          onDone={setAccess}
        />
      );
    }
    return (
      <ClaimScreen
        user={user}
        onDone={setAccess}
        onGoRegister={() => setMode('register')}
      />
    );
  }

  return (
    <StaffDashboard
      organizationId={access.organizationId}
      onLogout={async () => {
        await signOutUser();
        onExit();
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// App Principal
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [staffMode, setStaffMode] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { user, initializing } = useAuth();

  // Organización pública: ?org=<id> en la URL; sin parámetro = negocio default.
  const publicOrgId = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('org') || DEFAULT_ORG_ID)
    : DEFAULT_ORG_ID;

  // Sesión anónima para la vista pública (las reglas exigen auth para escribir).
  useEffect(() => {
    if (!initializing && !user) {
      signInAnonymous().catch((e) => console.warn('[Andi] No se pudo iniciar sesión anónima:', e));
    }
  }, [initializing, user]);

  // ── Detectar nueva versión de PWA ────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

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
    const initialTimer = setTimeout(checkForUpdates, 10000);

    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdates(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  const handleStaffAccess = useCallback(() => {
    setStaffMode(true);
  }, []);

  const handleStaffExit = useCallback(() => {
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
        <StaffRoot key={user ? user.uid : 'anon'} onExit={handleStaffExit} />
      ) : (
        <VistaCliente onStaffAccess={handleStaffAccess} organizationId={publicOrgId} />
      )}
    </>
  );
}
