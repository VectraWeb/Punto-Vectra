// PinGate.jsx — Barrera de acceso con PIN numérico
import { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { C, isStaffAuthenticated, markStaffAuthenticated } from '../utils';

const STAFF_PIN = import.meta.env.VITE_STAFF_PIN || '';

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

  if (!STAFF_PIN) {
    return (
      <div style={{
        minHeight: '100vh', background: '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Manrope", system-ui, sans-serif',
        padding: '24px', color: C.cream, textAlign: 'center',
      }}>
        <div style={{ maxWidth: '320px' }}>
          <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', margin: '0 0 10px' }}>
            Acceso deshabilitado
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            No hay PIN de staff configurado (VITE_STAFF_PIN). Contactá al administrador del sistema.
          </p>
          <button onClick={onBack} style={{
            marginTop: '20px', padding: '10px 20px', background: C.terra, border: 'none',
            borderRadius: '12px', cursor: 'pointer', color: '#fff', fontSize: '13px',
            fontWeight: 600, fontFamily: 'inherit',
          }}>
            ← Volver a reservas
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (pin === STAFF_PIN) {
      markStaffAuthenticated();
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
