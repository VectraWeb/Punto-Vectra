import { X } from 'lucide-react';
import { getCurrentPalette } from '../utils';
import { Overlay } from './ui';
import OrganizationSetup from './organization/OrganizationSetup';
import ClosureCalendar from './organization/ClosureCalendar';
import ServiceHours from './organization/ServiceHours';
import ThemeSelector from './ThemeSelector';

export default function SettingsModal({ config, onSave, onClose, organization = null, onSaveOrg = null, isRestaurant = true }) {
  const C = getCurrentPalette();
  return (
    <Overlay onClose={onClose} maxWidth="560px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--logo-font, "Fraunces", serif)', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>Configuración</h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
      </div>

      <ThemeSelector />

      {onSaveOrg && (
        <div style={{ marginTop: '16px' }}>
          <OrganizationSetup organization={organization} onSave={onSaveOrg} />
        </div>
      )}

      {onSaveOrg && (
        <div style={{ marginTop: '16px' }}>
          <ServiceHours organization={organization} onSave={onSaveOrg} />
        </div>
      )}

      {onSaveOrg && (
        <div style={{ marginTop: '16px' }}>
          <ClosureCalendar organization={organization} onSave={onSaveOrg} />
        </div>
      )}
    </Overlay>
  );
}
