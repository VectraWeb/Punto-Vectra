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

export const buildMesasList = () => {
  const mesas = [];
  let num = 1;
  for (const { cap, capacity, shape } of TABLE_GROUPS) {
    for (let i = 0; i < cap; i++) {
      mesas.push({ id: `m${num}`, name: `M${num}`, number: num, capacity, shape });
      num++;
    }
  }
  return mesas;
};

export const seedMesasIfNeeded = async () => {
  const snap = await getDocs(mesasCol());
  if (!snap.empty) return;

  const batch = writeBatch(db);
  const allMesas = buildMesasList();
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

export const subscribeMesas = (callback) => {
  const q = collection(db, 'mesas');
  return onSnapshot(q, (snap) => {
    const mesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(mesas);
  });
};
