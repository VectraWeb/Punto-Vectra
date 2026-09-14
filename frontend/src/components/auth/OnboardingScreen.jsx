// OnboardingScreen.jsx — Alta de un negocio nuevo (3 pasos).
// Paso 1: rubro. Paso 2: nombre + labels. Paso 3: recursos iniciales.
// Si ya hay un usuario autenticado (prop uid), no pide contraseña: solo
// vincula la organización a esa cuenta.

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { C } from '../../utils';
import { BUSINESS_TYPES, getBusinessType } from '../../config/businessTypes';
import { registerBusiness, setupOrganizationForUser } from '../../services/authService';

const inp = {
  width: '100%', padding: '12px 14px', fontSize: '15px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

const RUBROS = [
  ['restaurant', '🍽️'],
  ['salon', '✂️'],
  ['sports', '⚽'],
  ['hotel', '🏨'],
  ['coworking', '🏢'],
  ['healthcare', '🩺'],
  ['custom', '✨'],
];

export default function OnboardingScreen({ email = '', uid = null, onDone, onBack }) {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('restaurant');
  const [name, setName] = useState('');
  const [resourceLabel, setResourceLabel] = useState('Mesa');
  const [resourcePlural, setResourcePlural] = useState('Mesas');
  const [resourceCount, setResourceCount] = useState(3);
  const [capacity, setCapacity] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  const pickRubro = (key) => {
    setBusinessType(key);
    const cfg = getBusinessType(key);
    setResourceLabel(cfg.resourceLabel);
    setResourcePlural(cfg.resourcePlural);
    setCapacity(cfg.defaultResourceSeed.capacity);
    setResourceCount(cfg.defaultResourceSeed.count);
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const params = {
        email,
        businessType,
        name,
        resourceLabel,
        resourcePlural,
        resourceCount,
        capacity,
      };
      const result = uid
        ? await setupOrganizationForUser({ ...params, uid })
        : await registerBusiness({ ...params, password });
      if (onDone) onDone(result);
    } catch (err) {
      console.error('[Onboarding] Error registrando:', err);
      const msgMap = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'El email no es válido.',
      };
      setError(msgMap[err.code] || 'No se pudo crear la cuenta. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const needsPassword = !uid;
  const canFinish = name.trim().length >= 2 && (!needsPassword || password.length >= 6);

  return (
    <div style={{
      minHeight: '100vh', background: C.cream, color: C.espresso,
      fontFamily: '"Manrope", system-ui, sans-serif', padding: '24px 20px 48px',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {onBack && (
          <button onClick={onBack} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            padding: '0 0 12px',
          }}>
            <ArrowLeft size={16} /> Volver
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '28px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0 }}>
            Creá la cuenta de tu negocio
          </h1>
          {email && <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0' }}>{email}</p>}
        </div>

        {/* Pasos */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '18px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: step >= n ? C.terra : C.creamDeep,
            }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ background: C.white, borderRadius: '20px', padding: '20px', border: `1px solid ${C.creamDeep}` }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.forest, marginBottom: '12px' }}>
              ¿Qué tipo de negocio tenés?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {RUBROS.map(([key, emoji]) => {
                const cfg = BUSINESS_TYPES[key];
                const active = businessType === key;
                return (
                  <button key={key} onClick={() => pickRubro(key)} style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit',
                    background: active ? `${C.forest}14` : C.white,
                    border: `1.5px solid ${active ? C.forest : C.creamDeep}`,
                  }}>
                    <span style={{ fontSize: '20px' }}>{emoji}</span>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: C.espresso }}>{cfg.label}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>
                        {cfg.resourcePlural}: {cfg.defaultResourceSeed.count} iniciales
                      </div>
                    </div>
                    {active && <Check size={16} color={C.forest} />}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(2)} style={{
              width: '100%', padding: '14px', marginTop: '14px',
              background: C.terra, border: 'none', borderRadius: '12px', cursor: 'pointer',
              color: '#fff', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
            }}>
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: C.white, borderRadius: '20px', padding: '20px', border: `1px solid ${C.creamDeep}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.forest }}>
              Contanos sobre tu negocio
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                Nombre del negocio
              </label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Negocio" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                  Recurso (singular)
                </label>
                <input value={resourceLabel} onChange={e => setResourceLabel(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                  Recurso (plural)
                </label>
                <input value={resourcePlural} onChange={e => setResourcePlural(e.target.value)} style={inp} />
              </div>
            </div>
            {needsPassword && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                  Contraseña (mín. 6 caracteres)
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep(1)} style={{
                flex: 1, padding: '13px', background: C.creamDeep, border: 'none', borderRadius: '12px',
                cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: C.muted, fontFamily: 'inherit',
              }}>
                Volver
              </button>
              <button onClick={() => setStep(3)} disabled={name.trim().length < 2} style={{
                flex: 2, padding: '13px', background: name.trim().length >= 2 ? C.terra : C.creamDeep,
                border: 'none', borderRadius: '12px', cursor: name.trim().length >= 2 ? 'pointer' : 'not-allowed',
                fontSize: '14px', fontWeight: 600, color: name.trim().length >= 2 ? '#fff' : C.muted, fontFamily: 'inherit',
              }}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: C.white, borderRadius: '20px', padding: '20px', border: `1px solid ${C.creamDeep}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.forest }}>
              Tus {resourcePlural.toLowerCase()} iniciales
            </div>
            <p style={{ fontSize: '12px', color: C.muted, margin: 0, lineHeight: 1.5 }}>
              Creamos {resourceCount} {resourcePlural.toLowerCase()} llamadas {resourceLabel} 1, {resourceLabel} 2... Podés editarlas después desde el botón Recursos.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                  Cantidad
                </label>
                <input type="number" min={1} max={50} value={resourceCount} onChange={e => setResourceCount(Number(e.target.value) || 1)} style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '4px' }}>
                  Capacidad c/u
                </label>
                <input type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(Number(e.target.value) || 1)} style={inp} />
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b' }}>
                {error}
              </div>
            )}

            <button onClick={handleCreate} disabled={busy || !canFinish} style={{
              width: '100%', padding: '14px',
              background: busy || !canFinish ? C.creamDeep : C.forest,
              border: 'none', borderRadius: '12px',
              cursor: busy || !canFinish ? 'not-allowed' : 'pointer',
              color: busy || !canFinish ? C.muted : C.cream,
              fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
            }}>
              {busy ? 'Creando cuenta...' : needsPassword && password.length < 6 ? 'Elegí una contraseña en el paso anterior' : 'Crear mi negocio'}
            </button>

            <button onClick={() => setStep(2)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.muted,
              fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', padding: '4px',
              display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'center',
            }}>
              <ArrowLeft size={14} /> Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
