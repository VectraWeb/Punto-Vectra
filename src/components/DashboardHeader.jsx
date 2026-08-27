import { useState } from 'react';
import { Settings, Users, LogOut, BarChart3 } from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import { C, formatDate } from '../utils';

export function DashboardHeader({
  handleInstall, date, setDate,
  setShowAnalytics, setShowSettings, setShowStaff, setShowSectors, setShowResources,
  onLogout, orgName = 'Andi'
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
            {/* Desktop: botones individuales */}
            <div className="header-btns" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setShowAnalytics(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <BarChart3 size={18} />
              </button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Settings size={18} />
              </button>
              <button onClick={() => setShowResources(true)} title="Recursos (mesas, canchas, profesionales...)" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              </button>
              <button onClick={() => setShowStaff(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Users size={18} />
              </button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Settings size={18} />
              </button>
              <button onClick={() => setShowStaff(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <Users size={18} />
              </button>
              <button onClick={() => setShowSectors(true)} title="Sectores del salón" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button onClick={handleInstall} title="Instalar Andi en tu celular" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                App
              </button>
              <button onClick={onLogout} title="Salir del panel staff" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: C.cream, padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                <LogOut size={18} />
              </button>
            </div>
            {/* Mobile: menú hamburguesa */}
            <div style={{ position: 'relative' }}>
              <button className="header-menu-btn" onClick={() => setShowMenu(!showMenu)} style={{
                display: 'none', background: 'rgba(255,255,255,0.15)', border: 'none', color: C.cream,
                padding: '10px', borderRadius: '12px', cursor: 'pointer',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              {showMenu && (
                <>
                  <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                  <div className="mobile-dropdown" style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: C.forest, borderRadius: '14px', padding: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 200,
                    display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '180px',
                  }}>
                    {[
                      { icon: <BarChart3 size={16} />, label: 'Analíticas', action: () => { setShowAnalytics(true); setShowMenu(false); } },
                      { icon: <Settings size={16} />, label: 'Configuración', action: () => { setShowSettings(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, label: 'Recursos', action: () => { setShowResources(true); setShowMenu(false); } },
                      { icon: <Users size={16} />, label: 'Mozos', action: () => { setShowStaff(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, label: 'Sectores', action: () => { setShowSectors(true); setShowMenu(false); } },
                      { icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label: 'Instalar App', action: () => { handleInstall(); setShowMenu(false); } },
                      { icon: <LogOut size={16} />, label: 'Salir', action: () => { onLogout(); setShowMenu(false); } },
                    ].map((item, i) => (
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
