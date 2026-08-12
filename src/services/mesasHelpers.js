import { collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export const mesasCol = () => collection(db, 'mesas');
export const mesaDoc = (id) => doc(db, 'mesas', id);

const SHAPE_MAP_LOCAL = { redonda: 'round', rectangular: 'rectangular', cuadrada: 'square' };

function normalizeConfig(config) {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  if (typeof config === 'object') {
    const groups = [
      { capacidad: 2, forma: 'rectangular', cantidad: config.cap2 || 0 },
      { capacidad: 4, forma: 'rectangular', cantidad: config.cap4 || 0 },
      { capacidad: 5, forma: 'redonda', cantidad: config.cap5 || 0 },
      { capacidad: 8, forma: 'cuadrada', cantidad: config.cap8 || 0 },
    ];
    return groups.filter(g => g.cantidad > 0);
  }
  return [];
}

export const buildMesasList = (config) => {
  const items = normalizeConfig(config);
  const mesas = [];
  let num = 1;
  for (const item of items) {
    const cap = item.capacidad || item.capacity || 0;
    const count = item.cantidad || 1;
    const shape = SHAPE_MAP_LOCAL[item.forma] || item.shape || 'rectangular';
    for (let i = 0; i < count; i++) {
      mesas.push({ id: `m${num}`, name: `M${num}`, number: num, capacity: cap, shape });
      num++;
    }
  }
  return mesas;
};

export const seedMesasIfNeeded = async (config) => {
  const snap = await getDocs(mesasCol());
  if (!snap.empty) return;

  const batch = writeBatch(db);
  const allMesas = buildMesasList(config);
  for (const m of allMesas) {
    batch.set(mesaDoc(m.id), {
      capacity: m.capacity,
      name: m.name,
      number: m.number,
      shape: m.shape,
    });
  }
  await batch.commit();
};

export const syncMesasWithConfig = async (config) => {
  const snap = await getDocs(mesasCol());
  const existing = snap.docs.map(d => d.id);
  const desired = buildMesasList(config);
  const desiredIds = new Set(desired.map(m => m.id));

  const batch = writeBatch(db);

  for (const docId of existing) {
    if (!desiredIds.has(docId)) {
      batch.delete(mesaDoc(docId));
    }
  }

  for (const m of desired) {
    batch.set(mesaDoc(m.id), {
      capacity: m.capacity,
      name: m.name,
      number: m.number,
      shape: m.shape,
    });
  }

  await batch.commit();
};

export const subscribeMesas = (callback) => {
  const q = collection(db, 'mesas');
  return onSnapshot(q, (snap) => {
    const mesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(mesas);
  });
};
