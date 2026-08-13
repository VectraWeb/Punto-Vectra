// firebaseMock.js - Mock de Firebase y Firestore en localStorage

// Lista global de suscriptores a cambios
const listeners = new Set();

function notifyListeners(path) {
  for (const listener of listeners) {
    if (path.startsWith(listener.path) || listener.path.startsWith(path)) {
      listener.trigger();
    }
  }
}

// Helpers para procesar los objetos de Firebase
function parseStorageItem(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    // Reconstruir toDate en objetos que parezcan timestamps
    const restoreTimestamps = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      for (const k in obj) {
        const v = obj[k];
        if (v && typeof v === 'object' && v.seconds !== undefined) {
          obj[k] = {
            ...v,
            toDate: () => new Date(v.seconds * 1000)
          };
        } else if (v && typeof v === 'object') {
          restoreTimestamps(v);
        }
      }
      return obj;
    };
    return restoreTimestamps(data);
  } catch {
    return null;
  }
}

function getCollectionDocs(collectionPath) {
  const docs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`firestore:${collectionPath}/`)) {
      const id = key.substring(`firestore:${collectionPath}/`.length);
      const data = parseStorageItem(key);
      if (data) {
        docs.push({
          id,
          data: () => data
        });
      }
    }
  }
  return docs;
}

function processSpecialFields(data, existingData = {}) {
  const result = { ...data };
  for (const k in result) {
    const val = result[k];
    if (val && typeof val === 'object') {
      if (val._methodName === 'arrayUnion') {
        const currentArray = Array.isArray(existingData[k]) ? existingData[k] : [];
        const newElements = val.elements.filter(
          el => !currentArray.some(item => JSON.stringify(item) === JSON.stringify(el))
        );
        result[k] = [...currentArray, ...newElements];
      } else if (val._methodName === 'serverTimestamp') {
        result[k] = serverTimestamp();
      }
    }
  }
  return result;
}

// ─── Exportaciones compatibles con firebase/app y firebase/firestore ───

export function initializeApp() {
  return {};
}

export const db = { type: 'firestore' };
export function getFirestore() { return db; }
export function initializeFirestore() { return db; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const connectFirestoreEmulator = () => {};

export function collection(dbOrCol, path, ...segments) {
  const base = dbOrCol.path ? dbOrCol.path : '';
  const fullPath = [base, path, ...segments].filter(Boolean).join('/');
  return { type: 'collection', path: fullPath };
}

export function doc(dbOrColOrSnap, path, ...segments) {
  let base = '';
  if (dbOrColOrSnap.path) {
    base = dbOrColOrSnap.path;
  } else if (dbOrColOrSnap.type === 'firestore') {
    base = '';
  }
  const fullPath = [base, path, ...segments].filter(Boolean).join('/');
  return { type: 'document', path: fullPath };
}

export function serverTimestamp() {
  return {
    _methodName: 'serverTimestamp',
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
    toDate: () => new Date()
  };
}

export function arrayUnion(...elements) {
  return {
    _methodName: 'arrayUnion',
    elements
  };
}

export async function setDoc(docRef, data, options = {}) {
  const key = `firestore:${docRef.path}`;
  let existing = {};
  try {
    existing = parseStorageItem(key) || {};
  } catch { /* item inválido: se sobrescribe */ }

  let finalData;
  if (options.merge) {
    finalData = { ...existing, ...data };
  } else {
    finalData = { ...data };
  }

  finalData = processSpecialFields(finalData, existing);
  localStorage.setItem(key, JSON.stringify(finalData));
  notifyListeners(docRef.path);
}

export async function updateDoc(docRef, data) {
  const key = `firestore:${docRef.path}`;
  let existing = {};
  try {
    existing = parseStorageItem(key) || {};
  } catch { /* item inválido: se sobrescribe */ }

  const finalData = processSpecialFields({ ...existing, ...data }, existing);
  localStorage.setItem(key, JSON.stringify(finalData));
  notifyListeners(docRef.path);
}

export async function deleteDoc(docRef) {
  const key = `firestore:${docRef.path}`;
  localStorage.removeItem(key);
  notifyListeners(docRef.path);
}

export function onSnapshot(ref, onNext, onError) {
  void onError; // API de Firebase mantiene la firma, este mock no emite errores
  const trigger = () => {
    if (ref.type === 'collection') {
      const docs = getCollectionDocs(ref.path);
      onNext({
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (cb) => docs.forEach(cb)
      });
    } else {
      const key = `firestore:${ref.path}`;
      const val = localStorage.getItem(key);
      const exists = val !== null;
      onNext({
        exists: () => exists,
        data: () => exists ? parseStorageItem(key) : null,
        id: ref.path.split('/').pop()
      });
    }
  };

  const listenerObj = {
    path: ref.path,
    trigger
  };

  listeners.add(listenerObj);
  // Llamada inicial asíncrona inmediata
  setTimeout(trigger, 0);

  return () => {
    listeners.delete(listenerObj);
  };
}

export async function getDocs(ref) {
  const docs = getCollectionDocs(ref.path);
  return {
    docs,
    forEach: (cb) => docs.forEach(cb)
  };
}

export function query(collectionRef, ...constraints) {
  void constraints; // este mock ignora filtros/órdenes
  return collectionRef;
}

export function where() {
  return {};
}

export function writeBatch() {
  const ops = [];
  return {
    set(docRef, data, options) { ops.push({ type: 'set', docRef, data, options }); },
    delete(docRef) { ops.push({ type: 'delete', docRef }); },
    update(docRef, data) { ops.push({ type: 'update', docRef, data }); },
    async commit() {
      for (const op of ops) {
        if (op.type === 'set') await setDoc(op.docRef, op.data, op.options);
        else if (op.type === 'delete') await deleteDoc(op.docRef);
        else if (op.type === 'update') await updateDoc(op.docRef, op.data);
      }
    }
  };
}

export async function runTransaction(dbRef, updateFunction) {
  const transaction = {
    get: async (docRef) => {
      const key = `firestore:${docRef.path}`;
      const val = localStorage.getItem(key);
      const exists = val !== null;
      return {
        exists: () => exists,
        data: () => exists ? parseStorageItem(key) : null,
        id: docRef.path.split('/').pop()
      };
    },
    set: (docRef, data, options) => {
      setDoc(docRef, data, options);
    },
    update: (docRef, data) => {
      updateDoc(docRef, data);
    },
    delete: (docRef) => {
      deleteDoc(docRef);
    }
  };

  return await updateFunction(transaction);
}

export default {
  initializeApp,
  getFirestore,
  db
};
