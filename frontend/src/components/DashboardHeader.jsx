import { useState } from 'react';
import { Settings, Users, LogOut, BarChart3 } from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import { C, formatDate } from '../utils';

export function DashboardHeader({
  handleInstall, date, setDate,
  setShowAnalytics, setShowSettings, setShowStaff, setShowResources, setShowCarta,
  onLogout, orgName = 'PuntoVectra', isRestaurant = true
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  return (
      <header style={{ background: C.forest, color: C.cream, padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px 28px', borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.55, margin: 0 }}>Recepción</p>
            <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: '34px', fontStyle: 'italic', fontWeight: 600, margin: '2px 0 0', lineHeight: 1, letterSpacing: '-0.02em' }}>{orgName}</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMenu(!showMenu)} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: C.cream,
                padding: '10px', borderRadius: '12px', cursor: 'pointer',
              }}>
                <Settings size={18} />
              </button>
              {showMenu && (
                <>
                  <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: C.forest, borderRadius: '14px', padding: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 200,
                    display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px',
                  }}>
                    {[
                      { icon: <BarChart3 size={16} />, label: 'Analíticas', action: () => { setShowAnalytics(true); setShowMenu(false); } },
                      { icon: <Settings size={16} />, label: 'Configuración', action: () => { setShowSettings(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, label: 'Mesas', action: () => { setShowResources(true); setShowMenu(false); } },
                      { icon: <Users size={16} />, label: 'Mozos', restaurantOnly: true, action: () => { setShowStaff(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Carta', action: () => { setShowCarta(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>, label: 'Cocina', restaurantOnly: true, action: () => { window.open('/cocina', '_blank'); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label: 'Instalar App', action: () => { handleInstall(); setShowMenu(false); } },
                    ].filter(item => !item.restaurantOnly || isRestaurant).map((item, i) => (
                      <button key={i} onClick={item.action} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                        background: 'transparent', border: 'none', color: C.cream, borderRadius: '10px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 500, textAlign: 'left', width: '100%',
                      }}>
                        {item.icon}{item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={onLogout} title="Salir del panel staff" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Navegación de fecha */}
        <div style={{ position: 'relative', width: '100%' }}>
          <button onClick={() => setShowCalendar(!showCalendar)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '12px', color: C.cream, fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span>{formatDate(date)}</span>
          </button>

          {showCalendar && (
            <CalendarPicker
              date={date}
              onSelect={(d) => { setDate(d); setShowCalendar(false); }}
              onClose={() => setShowCalendar(false)}
              colors={C}
            />
          )}
        </div>
      </header>
  );
}
