// LoginScreen.jsx — Acceso de dueños de negocio (email + contraseña).
// Los clientes finales NO pasan por acá: ellos reservan desde la vista pública.

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { C } from '../../utils';
import { signInWithEmail } from '../../services/authService';

const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

const FIREBASE_ERRORS = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/invalid-email': 'El email no es válido.',
  'auth/user-not-found': 'No existe una cuenta con ese email.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
};

export default function LoginScreen({ onBack, onSuccess, onGoRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const user = await signInWithEmail(email, password);
      if (onSuccess) onSuccess(user);
    } catch (err) {
      console.error('[LoginScreen] Error:', err);
      setError(FIREBASE_ERRORS[err.code] || 'No se pudo iniciar sesión. Intentá de nuevo.');
    } finally {
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
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {onBack && (
          <button onClick={onBack} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            padding: '0 0 16px',
          }}>
            <ArrowLeft size={16} /> Volver
          </button>
        )}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '34px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0 }}>
            Andi
          </h1>
          <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Acceso para negocios
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: C.white, borderRadius: '20px', padding: '24px 20px',
          border: `1px solid ${C.creamDeep}`, display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@negocio.com"
              style={inp}
              autoFocus
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inp}
              required
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '14px',
            background: busy ? C.creamDeep : C.terra,
            border: 'none', borderRadius: '12px', cursor: busy ? 'not-allowed' : 'pointer',
            color: busy ? C.muted : '#fff', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
          }}>
            {busy ? 'Ingresando...' : 'Ingresar'}
          </button>

          {onGoRegister && (
            <button type="button" onClick={onGoRegister} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.forest, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', padding: '4px',
            }}>
              ¿Primera vez? Creá la cuenta de tu negocio
            </button>
          )}
        </form>

        <p style={{ textAlign: 'center', fontSize: '11px', color: C.muted, marginTop: '16px', lineHeight: 1.5 }}>
          Cada negocio tiene su propia cuenta y configuración:<br />rubro, recursos, reservas y agentes.
        </p>
      </div>
    </div>
  );
}
