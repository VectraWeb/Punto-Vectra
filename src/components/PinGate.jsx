// PinGate.jsx — Barrera de acceso con PIN numérico
import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

const C = {
  cream: '#f5efe6',
  creamDeep: '#ebe3d5',
  forest: '#7a3a1e',
  terra: '#c4602f',
  espresso: '#2a1f1a',
  muted: '#8b7d6b',
  white: '#fffdf8',
};

const STAFF_PIN = import.meta.env.VITE_STAFF_PIN || '2024';
const STORAGE_KEY = 'isStaff';

export function isStaffAuthenticated() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function logoutStaff() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function PinGate({ onAuthenticated, onBack, children }) {
  const [authenticated, setAuthenticated] = useState(() => isStaffAuthenticated());
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!authenticated && inputRef.current) {
      inputRef.current.focus();
    }
  }, [authenticated]);

  if (authenticated) {
    return children;
  }

  const handleSubmit = () => {
    if (pin === STAFF_PIN) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
      if (onAuthenticated) onAuthenticated();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#111',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Manrope", system-ui, sans-serif',
      padding: '24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Manrope:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        .pin-shake { animation: shake 0.4s ease-in-out; }
      `}</style>

      <div style={{
        width: '100%', maxWidth: '340px', textAlign: 'center',
      }}>
        {/* Icono */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <Lock size={28} color={C.terra} />
        </div>

        <h2 style={{
          fontFamily: '"Fraunces", serif', fontSize: '24px',
          fontStyle: 'italic', fontWeight: 600,
          color: C.cream, margin: '0 0 6px',
        }}>
          Acceso Staff
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>
          Ingresá el PIN para acceder al panel
        </p>

        {/* Input PIN */}
        <div className={error ? 'pin-shake' : ''}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(false); }}
            onKeyDown={handleKeyDown}
            placeholder="••••"
            style={{
              width: '100%', padding: '16px',
              fontSize: '28px', letterSpacing: '12px',
              textAlign: 'center', fontWeight: 600,
              background: 'rgba(255,255,255,0.06)',
              border: `2px solid ${error ? '#e06060' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '16px', color: C.cream,
              outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: '#e06060', margin: '10px 0 0' }}>
            PIN incorrecto
          </p>
        )}

        <button onClick={handleSubmit} style={{
          width: '100%', marginTop: '16px', padding: '14px',
          background: C.terra, border: 'none', borderRadius: '14px',
          cursor: 'pointer', color: '#fff',
          fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
        }}>
          Ingresar
        </button>

        {/* Link a vista cliente */}
        <button onClick={onBack} style={{
          marginTop: '20px', padding: '8px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.3)',
          fontSize: '12px', fontFamily: 'inherit',
        }}>
          ← Volver a reservas
        </button>
      </div>
    </div>
  );
}
