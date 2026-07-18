import { collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export const mesasCol = () => collection(db, 'mesas');
export const mesaDoc = (id) => doc(db, 'mesas', id);

const TABLE_GROUPS = [
  { cap: 12, capacity: 2, shape: 'rectangular' },
  { cap: 12, capacity: 4, shape: 'rectangular' },
  { cap: 5, capacity: 5, shape: 'round' },
  { cap: 2, capacity: 8, shape: 'square' },
];

export const buildMesasList = (config) => {
  const groups = config
    ? [
        { cap: config.cap2 || 0, capacity: 2, shape: 'rectangular' },
        { cap: config.cap4 || 0, capacity: 4, shape: 'rectangular' },
        { cap: config.cap5 || 0, capacity: 5, shape: 'round' },
        { cap: config.cap8 || 0, capacity: 8, shape: 'square' },
      ]
    : TABLE_GROUPS;

  const mesas = [];
  let num = 1;
  for (const { cap, capacity, shape } of groups) {
    for (let i = 0; i < cap; i++) {
      mesas.push({ id: `m${num}`, name: `M${num}`, number: num, capacity, shape });
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
