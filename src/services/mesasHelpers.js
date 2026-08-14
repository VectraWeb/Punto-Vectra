import { collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { buildTables } from '../utils';

export const mesasCol = () => collection(db, 'mesas');
export const mesaDoc = (id) => doc(db, 'mesas', id);

// Unifica la construcción de mesas en utils.buildTables para evitar que el
// seed de la colección "mesas" diverja del plano (formas/capacidades).
export const buildMesasList = (config) => buildTables(config);

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
