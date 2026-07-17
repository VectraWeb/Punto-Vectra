import React, { useState, useEffect } from 'react';
import { useMesas } from '../hooks/useMesas';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { X, Users, MessageSquare, Clock, AlertTriangle, ShieldCheck, User } from 'lucide-react';


const SalonView = ({ date, service }) => {
  const { tables } = useMesas(date, service);
  // selectedTableId almacena solo el ID; los datos del modal se derivan SIEMPRE
  // de `tables` en tiempo real para evitar mostrar datos stale (desactualizados).
  const [selectedTableId, setSelectedTableId] = useState(null);
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Detección de Rol: URL ?mode=staff → staff, cualquier otro → cliente
  const [rol, setRol] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'staff' ? 'staff' : 'cliente';
  });

  // Lógica de Formulario con Programación Defensiva
  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    partySize: 2, 
    time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    tableId: '' 
  });

  // Inicializar mesa seleccionada en el formulario al abrir el modal
  useEffect(() => {
    if (selectedTableId) {
      setForm(prev => ({ ...prev, tableId: selectedTableId }));
    }
  }, [selectedTableId]);

  // Escuchar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Mapeo de estados a colores de Tailwind
  const statusColors = {
    'Libre': 'bg-emerald-50 border-emerald-100 text-emerald-800',
    'Reservada': 'bg-amber-50 border-amber-100 text-amber-800',
    'Ocupada': 'bg-rose-50 border-rose-100 text-rose-800',
    'Esperando cuenta': 'bg-sky-50 border-sky-100 text-sky-800',
  };

  // Cierra el modal de forma limpia
  const cerrarModal = () => {
    setSelectedTableId(null);
    setForm({ name: '', phone: '', partySize: 2, time: '', tableId: '' });
  };

  const handleUpdateStatus = async (resId, newState) => {
    if (rol !== 'staff') return;
    try {
      const resRef = doc(db, 'reservations', resId);
      await updateDoc(resRef, {
        liveState: newState,
        updatedAt: serverTimestamp()
      });
      cerrarModal();
    } catch (error) {
      console.error('[handleUpdateStatus] Error:', error);
    }
  };

  const handleAddComanda = async (itemName) => {
    if (!selectedTable?.reservation) return;
    try {
      const comanda = {
        id: `c_${Date.now()}`,
        nombre: itemName,
        estado: 'pedido',
        hora_pedido: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const resRef = doc(db, 'reservations', selectedTable.reservation.id);
      await updateDoc(resRef, {
        comandas: arrayUnion(comanda),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error al añadir comanda:", error);
    }
  };

  // --- LÓGICA DE VALIDACIÓN EXHAUSTIVA ---
  
  // 1. Filtrado de Horarios (Evitar "Time Travel")
  const availableSlots = React.useMemo(() => {
    // Generamos slots de 15 min para el servicio actual (simplificado para el ejemplo)
    const slots = [];
    const [startH] = (service === 'mediodia' ? '12:00' : '20:00').split(':').map(Number);
    for (let h = startH; h < startH + 4; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return slots.filter(s => s >= nowStr);
  }, [service]);

  // 2. Filtrado de Mesas (Capacidad + Disponibilidad Real)
  const aptTables = React.useMemo(() => {
    return tables.filter(t => 
      t.status === 'Libre' && 
      t.capacity >= form.partySize
    );
  }, [tables, form.partySize]);

  // 3. Reset en Cascada (Defensivo)
  useEffect(() => {
    const isStillApt = aptTables.some(t => t.id === form.tableId);
    if (form.tableId && !isStillApt) {
      setForm(prev => ({ ...prev, tableId: '' }));
    }
  }, [aptTables, form.tableId]);

  // 4. Validación de Botón "Confirmar"
  const isFormValid = 
    form.name.trim().length >= 3 && 
    form.tableId !== '' && 
    form.partySize > 0 && 
    availableSlots.includes(form.time);

  const handleToggleComandaStatus = async (item) => {
    if (!selectedTable?.reservation) return;
    try {
      const resRef = doc(db, 'reservations', selectedTable.reservation.id);
      
      await runTransaction(db, async (transaction) => {
        const resDoc = await transaction.get(resRef);
        if (!resDoc.exists()) return;
        
        const currentComandas = resDoc.data().comandas || [];
        const updatedComandas = currentComandas.map(c => 
          c.id === item.id ? { ...c, estado: c.estado === 'pedido' ? 'entregado' : 'pedido' } : c
        );
        
        transaction.update(resRef, { 
          comandas: updatedComandas,
          updatedAt: serverTimestamp() 
        });
      });
    } catch (error) {
      console.error("Error concurrente en transacción de comanda:", error);
    }
  };

  const handleCreateReservation = async () => {
    if (!isFormValid) return;
    try {
      const resId = `res_${Date.now()}`;
      const resRef = doc(db, 'reservations', resId);
      const finalTable = tables.find(t => t.id === form.tableId);
      
      await setDoc(resRef, {
        id: resId,
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        partySize: form.partySize,
        tableId: form.tableId,
        mesa_id: form.tableId,
        time: form.time,
        duration: TANDA_PROMEDIO,
        service,
        date,
        liveState: 'esperando_cliente',
        comandas: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      cerrarModal();
      alert('¡Reserva confirmada!');
    } catch (error) {
      console.error('[handleCreateReservation] Error:', error);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans relative">
      
      {/* Botonera de Pruebas (Dev Switcher) */}
      <div className="fixed bottom-6 left-6 z-[60] bg-white/80 backdrop-blur shadow-lg border border-slate-200 rounded-2xl p-1 flex gap-1">
        <button 
          onClick={() => setRol('cliente')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${rol === 'cliente' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <User size={14} /> Cliente
        </button>
        <button 
          onClick={() => setRol('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${rol === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <ShieldCheck size={14} /> Staff
        </button>
      </div>

      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-slate-800">Vista del Salón</h1>
              
              {/* Conectivity Badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700 animate-pulse'}`}>
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                {isOnline ? 'Sincronizado' : 'Offline'}
              </div>

              {/* Role Indicator */}
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${rol === 'staff' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {rol === 'staff' ? 'Modo Staff' : 'Vista Cliente'}
              </div>
            </div>
            <p className="text-slate-500 uppercase tracking-widest text-xs font-semibold">
              {service} • {date}
            </p>
          </div>
          <div className="hidden md:flex gap-4 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Ocupada</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Reservada</span>
          </div>
        </header>

        {/* Grilla de Mesas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {tables.map((table) => {
            return (
              <button
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`
                  relative p-6 rounded-3xl border-2 transition-all duration-500
                  flex flex-col items-center justify-center gap-2
                  ${statusColors[table.status] || 'bg-white border-slate-200'}
                  hover:shadow-xl hover:-translate-y-1 active:scale-95
                `}
              >
                <span className="text-3xl font-black tracking-tighter">{table.name}</span>
                
                <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-60 uppercase">
                  <Users size={12} />
                  <span>{table.capacity}P</span>
                </div>

                <span className="mt-1 text-[9px] uppercase font-black tracking-widest opacity-40">
                  {table.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modal Dinámico (Staff vs Cliente) */}
        {selectedTable && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto transform transition-all border border-white/20">
              
              {/* Header del Modal */}
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl font-black text-slate-800">{selectedTable.name}</span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase">{selectedTable.status}</span>
                  </div>
                  {selectedTable.reservation && (
                    <p className="text-sm font-medium text-slate-500">{selectedTable.reservation.customerName}</p>
                  )}
                </div>
                <button 
                  onClick={cerrarModal}
                  className="p-3 bg-slate-200/50 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Contenido según ROL y ESTADO */}
              <div className="p-8">
                {rol === 'staff' ? (
                  /* VISTA STAFF: Control total + Comandas */
                  <div className="space-y-6">
                    {/* Control de Estados */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Control de Personal</p>
                      {selectedTable.reservation ? (
                        /* Lógica de Botonera Dinámica */
                        (selectedTable.status === 'Reservada' ? [
                          { id: 'ocupada', label: 'Confirmar Llegada', color: 'bg-rose-400', sub: 'Ocupar mesa ahora' },
                          { id: 'liberada', label: 'Cancelar Reserva (No-Show)', color: 'bg-emerald-400', sub: 'Liberar para el salón' },
                        ] : [
                          { id: 'comiendo_entrada', label: 'Entrada', color: 'bg-amber-600', sub: 'Iniciando servicio' },
                          { id: 'plato_principal', label: 'Principal', color: 'bg-rose-700', sub: 'Plato fuerte' },
                          { id: 'en_postre_cafe', label: 'Postre / Café', color: 'bg-amber-500', sub: 'Finalizando' },
                          { id: 'liberada', label: 'Finalizar y Liberar', color: 'bg-emerald-400', sub: 'Mesa lista para otro cliente' },
                        ]).map((state) => (
                          <button
                            key={state.id}
                            onClick={() => handleUpdateStatus(selectedTable.reservation.id, state.id)}
                            className="w-full flex items-center gap-4 p-4 rounded-3xl hover:bg-slate-50 border-2 border-transparent hover:border-slate-100 transition-all text-left group"
                          >
                            <div className={`w-3.5 h-3.5 rounded-full ${state.color} group-hover:scale-125 transition-transform`}></div>
                            <div>
                              <div className="font-bold text-slate-700 text-sm">{state.label}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{state.sub}</div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-slate-500 text-center py-8 italic font-medium">Mesa libre. No hay servicio activo.</p>
                      )}
                    </div>

                    {/* Módulo de Comandas (Solo si está ocupada) */}
                    {selectedTable.reservation && selectedTable.status !== 'Libre' && (
                      <div className="pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Comandas Rápidas</p>
                        
                        {/* Botones de Añadir */}
                        <div className="grid grid-cols-2 gap-2 mb-6">
                          {['Agua', 'Gaseosa', 'Cerveza', 'Hamburguesa'].map(item => (
                            <button
                              key={item}
                              onClick={() => handleAddComanda(item)}
                              className="p-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all border border-transparent hover:border-indigo-100"
                            >
                              + {item}
                            </button>
                          ))}
                        </div>

                        {/* Lista de Consumos */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {selectedTable.reservation.comandas?.map((item) => (
                            <div 
                              key={item.id}
                              onClick={() => handleToggleComandaStatus(item)}
                              className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${item.estado === 'entregado' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-indigo-100 shadow-sm'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${item.estado === 'entregado' ? 'bg-slate-400' : 'bg-indigo-500 animate-pulse'}`}></div>
                                <span className={`text-sm font-bold ${item.estado === 'entregado' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.nombre}</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">{item.hora_pedido}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumen de Ticket (Solo cuando esperan cuenta) */}
                    {selectedTable.status === 'Esperando cuenta' && selectedTable.reservation.comandas?.length > 0 && (
                      <div className="mt-8 p-6 bg-slate-900 rounded-[2rem] text-white">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                          <span>Resumen de Consumos</span>
                          <span>Ticket #001</span>
                        </p>
                        <div className="space-y-2 mb-6">
                          {selectedTable.reservation.comandas.map(c => (
                            <div key={c.id} className="flex justify-between text-sm font-medium">
                              <span className="opacity-80">{c.nombre}</span>
                              <span className="font-mono">$ —</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-white/10 pt-4 flex justify-between items-end">
                          <span className="text-xs font-bold uppercase opacity-60">Total Estimado</span>
                          <span className="text-2xl font-black tracking-tighter">LISTO PARA COBRAR</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* VISTA CLIENTE */
                  <div>
                    {selectedTable.status === 'Libre' ? (
                      <div className="space-y-6">
                        <div className="text-center mb-6">
                          <h4 className="text-lg font-bold text-slate-800">¿Quieres esta mesa?</h4>
                          <p className="text-sm text-slate-500">Completa tus datos para reservarla ahora mismo.</p>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comensales</label>
                              <select 
                                value={form.partySize}
                                onChange={(e) => setForm({...form, partySize: parseInt(e.target.value)})}
                                className="w-full mt-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none transition-all font-bold"
                              >
                                {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} personas</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mesa</label>
                              <select 
                                value={form.tableId}
                                onChange={(e) => setForm({...form, tableId: e.target.value})}
                                className="w-full mt-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none transition-all font-bold"
                              >
                                {aptTables.length > 0 ? (
                                  <>
                                    <option value="">— Elegir —</option>
                                    {aptTables.map(t => <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>)}
                                  </>
                                ) : (
                                  <option disabled>— Sin capacidad —</option>
                                )}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                              <input 
                                type="text" 
                                value={form.name}
                                onChange={(e) => setForm({...form, name: e.target.value})}
                                placeholder="Ej: Ariel Peluzzo"
                                className="w-full mt-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none transition-all font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</label>
                              <select 
                                value={form.time}
                                onChange={(e) => setForm({...form, time: e.target.value})}
                                className="w-full mt-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none transition-all font-bold"
                              >
                                {availableSlots.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                            <input 
                              type="tel" 
                              value={form.phone}
                              onChange={(e) => setForm({...form, phone: e.target.value})}
                              placeholder="Ej: +54 9 11..."
                              className="w-full mt-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none transition-all font-bold"
                            />
                          </div>

                          <button 
                            onClick={handleCreateReservation}
                            disabled={!isFormValid}
                            className={`w-full p-5 rounded-3xl font-bold text-white shadow-lg transition-all ${isFormValid ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-slate-200 cursor-not-allowed text-slate-400 opacity-60'}`}
                          >
                            Confirmar Reserva
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Mesa Ocupada para Cliente */
                      <div className="py-12 text-center flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
                          <AlertTriangle size={40} />
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800 tracking-tight">Mesa no disponible</h4>
                        <p className="text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                          Esta mesa se encuentra ocupada o reservada en este momento. Por favor, elige otra mesa que esté en <span className="text-emerald-500 font-bold underline">verde</span>.
                        </p>
                        <button 
                          onClick={cerrarModal}
                          className="mt-4 px-8 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-xl"
                        >
                          Entendido
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notas (Solo Staff) */}
              {rol === 'staff' && selectedTable.reservation?.notes && (
                <div className="px-8 pb-8">
                  <div className="bg-amber-50 rounded-[1.5rem] p-5 flex gap-3 text-amber-800 text-sm italic border border-amber-100/50">
                    <MessageSquare size={18} className="shrink-0 mt-0.5 opacity-50" />
                    <p className="leading-relaxed">{selectedTable.reservation.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalonView;
