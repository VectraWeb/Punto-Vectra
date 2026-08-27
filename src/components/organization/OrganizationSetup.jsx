// OrganizationSetup.jsx — Configuración mínima del negocio (onboarding).
// Paso 1: tipo de negocio. Paso 2: nombre y labels de los recursos.
// Guarda en organizations/{id} (saveOrganization) y espeja en config/restaurant.

import { useState } from 'react';
import { C } from '../../utils';
import { BUSINESS_TYPES, getBusinessType } from '../../config/businessTypes';

const inp = {
  width: '100%', padding: '10px 12px', fontSize: '14px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '10px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

export default function OrganizationSetup({ organization, onSave, onSaved }) {
  const typeCfg = getBusinessType(organization?.businessType);
  const [businessType, setBusinessType] = useState(organization?.businessType || 'restaurant');
  const [name, setName] = useState(organization?.name || '');
  const [resourceLabel, setResourceLabel] = useState(
    organization?.configuration?.resourceLabel || typeCfg.resourceLabel
  );
  const [resourcePlural, setResourcePlural] = useState(
    organization?.configuration?.resourcePlural || typeCfg.resourcePlural
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Al cambiar de tipo, se sugieren los labels del nuevo negocio (editables).
  const handleTypeChange = (t) => {
    setBusinessType(t);
    const cfg = getBusinessType(t);
    setResourceLabel(cfg.resourceLabel);
    setResourcePlural(cfg.resourcePlural);
  };

  const valid = name.trim().length >= 2 && resourceLabel.trim() && resourcePlural.trim();

  const handleSave = async () => {
    if (!valid) { setError('Completá el nombre del negocio y los labels del recurso.'); return; }
    setSaving(true);
    setError('');
    try {
      const next = {
        ...organization,
        id: organization?.id || 'default',
        name: name.trim(),
        businessType,
        configuration: {
          ...(organization?.configuration || {}),
          resourceLabel: resourceLabel.trim(),
          resourcePlural: resourcePlural.trim(),
        },
      };
      await onSave(next);
      if (onSaved) onSaved(next);
    } catch (e) {
      console.error('[OrganizationSetup] Error guardando:', e);
      setError('No se pudo guardar la configuración del negocio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: C.white, borderRadius: '14px', padding: '14px', border: `1px solid ${C.creamDeep}`, marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: C.forest, marginBottom: '2px' }}>
        Mi negocio
      </div>
      <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px', lineHeight: 1.4 }}>
        Elegí el tipo de negocio: define cómo se llaman tus recursos reservables.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
            Tipo de negocio
          </label>
          <select value={businessType} onChange={e => handleTypeChange(e.target.value)} style={inp}>
            {Object.entries(BUSINESS_TYPES).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
            Nombre del negocio
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Restaurante" style={inp} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
              Recurso (singular)
            </label>
            <input value={resourceLabel} onChange={e => setResourceLabel(e.target.value)} placeholder="Mesa" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
              Recurso (plural)
            </label>
            <input value={resourcePlural} onChange={e => setResourcePlural(e.target.value)} placeholder="Mesas" style={inp} />
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '11px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !valid} style={{
          width: '100%', padding: '10px',
          background: valid ? C.forest : C.creamDeep,
          border: 'none', borderRadius: '10px', cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? C.cream : C.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : 'Guardar negocio'}
        </button>
      </div>
    </div>
  );
}
