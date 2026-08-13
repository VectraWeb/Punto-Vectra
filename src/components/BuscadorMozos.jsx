import React, { useState, useMemo } from 'react';
import { ChevronLeft, Users, Clock, Grid } from 'lucide-react';
import { C, LIVE_STATES } from '../utils';
import { Overlay } from './LiveStateModal';

const DEFAULT_ASSIGNMENTS = {
  leo: [60,61,62,63,64,65,66,67,68,69,160,161,162,163,164],
  mica: [51,52,53,54,55,56,57,58,59,150,151,152,153,154],
  mauro: [40,41,42,43,44,45,46,47,48,49,140,141,142,143,144],
  rosanna: [20,21,22,23,24,25,26,27,28,29,120,121,122,123,124],
  jota: [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
  miguel: [30,31,32,33,34,35,36,37,38,39,130,131,132,133,134],
};

function getAssignedTables(s) {
  const fromDb = Array.isArray(s.assignedTables) ? s.assignedTables : [];
  if (fromDb.length > 0) return fromDb;
  const lower = (s.name || '').toLowerCase().trim();
  const nums = DEFAULT_ASSIGNMENTS[lower];
  if (!nums) return [];
  return nums.map(n => `m${n}`);
}

function getTableNames(tableIds, tables) {
  if (!Array.isArray(tableIds) || tableIds.length === 0) return [];
  if (!Array.isArray(tables)) return tableIds.map(id => id.replace('m', ''));
  return tableIds.map(id => {
    const t = tables.find(tb => tb.id === id);
    return t ? t.name : id;
  });
}

export default function BuscadorMozos({ staff, reservations, tables, onEdit, onClose }) {
  const [selectedStaff, setSelectedStaff] = useState(null);

  const staffWithRes = useMemo(() => {
    const list = Array.isArray(staff) ? staff : [];
    const resList = Array.isArray(reservations) ? reservations : [];
    const tblList = Array.isArray(tables) ? tables : [];
    return list.filter(s => s && s.active !== false).map(s => {
      const assignedTables = getAssignedTables(s);
      const matchedRes = resList.filter(r =>
        r && r.staffName === s.name && r.liveState !== 'finalizado'
      );
      const tableNames = getTableNames(assignedTables, tblList);
      return { ...s, reservations: matchedRes, assignedTables, tableNames };
    });
  }, [staff, reservations, tables]);

  const selectedData = useMemo(() => {
    if (!selectedStaff) return null;
    const tblList = Array.isArray(tables) ? tables : [];
    const resList = Array.isArray(reservations) ? reservations : [];
    const assignedTables = getAssignedTables(selectedStaff);
    const matchedRes = resList.filter(r =>
      r && r.staffName === selectedStaff.name && r.liveState !== 'finalizado'
    );
    const byTable = {};
    for (const r of matchedRes) {
      const tId = r.tableId || 'sin_mesa';
      if (!byTable[tId]) byTable[tId] = [];
      byTable[tId].push(r);
    }
    const tableNames = getTableNames(assignedTables, tblList);
    return { ...selectedStaff, reservations: matchedRes, byTable, assignedTables, tableNames };
  }, [selectedStaff, reservations, tables]);

  const getTableName = (tableId) => {
    const tblList = Array.isArray(tables) ? tables : [];
    const t = tblList.find(tb => tb.id === tableId);
    return t ? t.name : tableId;
  };

  if (selectedData) {
    return (
      <Overlay onClose={onClose} maxWidth="480px">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setSelectedStaff(null)} style={{
            background: C.creamDeep, border: 'none', borderRadius: '10px',
            padding: '8px', cursor: 'pointer', color: C.muted,
          }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: C.forest, color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 700, flexShrink: 0,
          }}>
            {selectedData.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
              {selectedData.name}
            </h3>
            <div style={{ fontSize: '12px', color: C.muted }}>
              {selectedData.reservations.length} reserva{selectedData.reservations.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {selectedData.assignedTables.length > 0 && (
          <div style={{
            background: C.creamDeep, borderRadius: '12px', padding: '12px',
            marginBottom: '16px', fontSize: '12px',
          }}>
            <div style={{ fontWeight: 600, color: C.forest, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Grid size={12} /> Mesas asignadas ({selectedData.assignedTables.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {selectedData.tableNames.map((name, i) => (
                <span key={i} style={{
                  background: C.white, border: `1px solid ${C.creamDeep}`,
                  borderRadius: '6px', padding: '3px 8px', fontSize: '11px',
                  color: C.espresso, fontWeight: 500,
                }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedData.reservations.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center', color: C.muted,
            background: C.creamDeep, borderRadius: '14px', fontSize: '13px',
          }}>
            Este mozo no tiene reservas asignadas en este servicio
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(selectedData.byTable).map(([tableId, resList]) => {
              return (
                <div key={tableId}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: C.forest, marginBottom: '8px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: C.forest, display: 'inline-block',
                    }} />
                    {getTableName(tableId)} ({resList.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {resList.map(r => {
                      const live = r.liveState ? LIVE_STATES[r.liveState] : null;
                      const badgeLabel = live ? live.label : 'Próxima';
                      const badgeColor = live ? live.color : C.forestSoft;
                      return (
                        <button key={r.id} onClick={() => onEdit(r)} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                          background: C.white, border: `1px solid ${C.creamDeep}`,
                          borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                          color: C.espresso,
                        }}>
                          <div style={{
                            width: '44px', minWidth: '44px', height: '44px', borderRadius: '10px',
                            background: badgeColor, color: C.cream,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: '"Fraunces", serif', fontSize: '13px', fontWeight: 600,
                            flexDirection: 'column', gap: '1px',
                          }}>
                            <span>{r.time}</span>
                            <span style={{ fontSize: '7px', opacity: 0.85 }}>{badgeLabel}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.customerName}
                            </div>
                            <div style={{ fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={10} />{r.partySize}</span>
                              <span>·</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{r.time}</span>
                              {r.phone && (<><span>·</span><span>{r.phone}</span></>)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose} maxWidth="480px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          Mozos
        </h3>
        <button onClick={onClose} style={{
          background: C.creamDeep, border: 'none', borderRadius: '10px',
          padding: '8px', cursor: 'pointer', color: C.muted,
        }}>
          <span style={{ fontSize: '18px' }}>×</span>
        </button>
      </div>

      {staffWithRes.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center', color: C.muted,
          background: C.creamDeep, borderRadius: '14px', fontSize: '13px',
        }}>
          No hay mozos activos cargados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {staffWithRes.map(s => (
            <button key={s.id} onClick={() => setSelectedStaff(s)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
              background: C.white, border: `1.5px solid ${C.creamDeep}`,
              borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
              color: C.espresso, width: '100%',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: C.forest, color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, flexShrink: 0,
              }}>
                {s.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '15px', color: C.espresso }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  {s.assignedTables.length > 0 ? (
                    <>
                      <span style={{ fontWeight: 600, color: C.forest }}>{s.assignedTables.length} mesa{s.assignedTables.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tableNames.join(', ')}</span>
                    </>
                  ) : (
                    <span>Sin mesas asignadas</span>
                  )}
                </div>
              </div>
              <div style={{
                background: s.reservations.length > 0 ? C.terra : C.creamDeep,
                color: s.reservations.length > 0 ? C.white : C.muted,
                padding: '6px 10px', borderRadius: '8px',
                fontSize: '11px', fontWeight: 600, textAlign: 'center', minWidth: '32px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.reservations.length}</div>
                <div style={{ fontSize: '8px', opacity: 0.8 }}>reservas</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Overlay>
  );
}
