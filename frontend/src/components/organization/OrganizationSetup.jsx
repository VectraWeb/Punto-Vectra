// OrganizationSetup.jsx — Configuración mínima del negocio (onboarding).
// Paso 1: tipo de negocio. Paso 2: nombre y labels de los recursos.
// Guarda en organizations/{id} (saveOrganization) y espeja en config/restaurant.

import { useState, useRef } from 'react';
import { C, setFavicon } from '../../utils';
import { getBusinessType } from '../../config/businessTypes';
import FontSelector from '../FontSelector';

const inp = {
  width: '100%', padding: '10px 12px', fontSize: '14px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '10px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

export default function OrganizationSetup({ organization, onSave, onSaved }) {
  const businessType = 'restaurant';
  const typeCfg = getBusinessType(businessType);
  const [name, setName] = useState(organization?.name || '');
  const [logo, setLogo] = useState(organization?.logo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const valid = name.trim().length >= 2;

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!valid) { setError('Completá el nombre del negocio.'); return; }
    setSaving(true);
    setError('');
    try {
      const next = {
        ...organization,
        id: organization?.id || 'default',
        name: name.trim(),
        businessType,
        logo,
        configuration: {
          ...(organization?.configuration || {}),
          resourceLabel: typeCfg.resourceLabel,
          resourcePlural: typeCfg.resourcePlural,
        },
      };
      await onSave(next);
      setFavicon(next.logo || '');
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
        Nombre de tu restaurante, como lo ven los clientes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
            Nombre del negocio
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Restaurante" style={inp} />
        </div>

        <div>
          <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '4px' }}>
            Icono del negocio
          </label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', background: C.white, border: `1.5px solid ${C.creamDeep}`,
            borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {logo ? (
              <img src={logo} alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.forest}, ${C.forest}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: C.cream, fontSize: '15px', fontWeight: 700, fontFamily: 'var(--logo-font, "Fraunces", serif)', fontStyle: 'italic' }}>
                  {(name || 'P')[0].toUpperCase()}
                </span>
              </div>
            )}
            <span style={{ fontSize: '12px', color: logo ? C.espresso : C.muted, fontWeight: 500 }}>
              {logo ? 'Cambiar icono' : 'Subir icono'}
            </span>
          </button>
        </div>

        <FontSelector previewName={name || 'PuntoVectra'} />

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
