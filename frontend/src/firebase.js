// firebase.js — Compatibility shim that routes Firestore calls through the backend API
// This file replaces the Firebase SDK while keeping the same interface for components.

import api from './services/api/client';

const API_URL = api.defaults.baseURL;

// ── Reference objects ─────────────────────────────────────────────────────────
function doc(db, collectionPath, id) {
  return { _type: 'doc', _collection: collectionPath, _id: id };
}

function collection(db, collectionPath) {
  return { _type: 'collection', _collection: collectionPath };
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────
function serverTimestamp() {
  return { _type: 'serverTimestamp', _value: new Date().toISOString() };
}

function arrayUnion(...elements) {
  return { _type: 'arrayUnion', _elements: elements };
}

// ── CRUD operations ───────────────────────────────────────────────────────────
async function setDoc(docRef, data, options = {}) {
  const { _collection, _id } = docRef;
  const merged = { ...data };

  // Resolve special values
  for (const [key, val] of Object.entries(merged)) {
    if (val && val._type === 'serverTimestamp') {
      merged[key] = val._value;
    }
    if (val && val._type === 'arrayUnion') {
      merged[key] = val._elements;
    }
  }

  const endpoint = getEndpoint(_collection);
  if (endpoint === 'config') {
    if (options.merge) {
      await api.patch(`${endpoint}/${_id}`, merged);
    } else {
      await api.put(`${endpoint}/${_id}`, merged);
    }
  } else if (options.merge === true && _id) {
    // setDoc con merge: actualiza el documento existente.
    await api.put(`${endpoint}/${_id}`, merged);
  } else {
    merged.id = _id;
    await api.post(`${endpoint}`, merged);
  }
}

async function updateDoc(docRef, data) {
  const { _collection, _id } = docRef;
  const merged = { ...data };

  // Resolve special values
  for (const [key, val] of Object.entries(merged)) {
    if (val && val._type === 'serverTimestamp') {
      merged[key] = val._value;
    }
    if (val && val._type === 'arrayUnion') {
      merged[key] = val._elements;
    }
  }

  const endpoint = getEndpoint(_collection);
  await api.put(`${endpoint}/${_id}`, merged);
}

async function deleteDoc(docRef) {
  const { _collection, _id } = docRef;
  const endpoint = getEndpoint(_collection);
  await api.delete(`${endpoint}/${_id}`);
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function where(fieldPath, opStr, value) {
  return { _type: 'where', field: fieldPath, op: opStr, value };
}

function query(collectionRef, ...queryConstraints) {
  return { _type: 'query', _collection: collectionRef._collection, constraints: queryConstraints };
}

// ── Snapshot listener (polling-based) ────────────────────────────────────────
function onSnapshot(queryOrDoc, callback, errorCallback) {
  let polling = true;
  let timer = null;

  const fetchData = async () => {
    try {
      if (queryOrDoc._type === 'query') {
        const { _collection, constraints } = queryOrDoc;
        const endpoint = getEndpoint(_collection);
        const params = {};
        for (const c of constraints) {
          if (c._type === 'where') {
            params[c.field] = c.value;
          }
        }
        const res = await api.get(endpoint, { params });
        const docs = (res.data.data || res.data || []).map(d => ({
          id: d.id,
          data: () => d,
        }));
        callback({ docs, exists: () => docs.length > 0, size: docs.length });
      } else if (queryOrDoc._type === 'doc') {
        const endpoint = getEndpoint(queryOrDoc._collection);
        const res = await api.get(`${endpoint}/${queryOrDoc._id}`);
        const d = res.data;
        callback({
          exists: () => !!d,
          data: () => d,
          id: d?.id,
        });
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  fetchData();
  timer = setInterval(() => {
    if (polling) fetchData();
  }, 3000);

  return () => {
    polling = false;
    if (timer) clearInterval(timer);
  };
}

// ── Collection endpoint mapping ───────────────────────────────────────────────
function getEndpoint(collectionName) {
  const map = {
    reservations: '/reservations',
    orders: '/orders',
    pedidos: '/orders',
    staff: '/staff',
    config: '/config',
    organizations: '/organizations',
    branches: '/branches',
    resources: '/resources',
    customers: '/customers',
    catalog: '/catalog',
    audit: '/audit',
    mesas: '/resources',
    mesasReservadas: '/reservations',
    'salon-layout': '/config/salon-layout',
  };
  return map[collectionName] || `/${collectionName}`;
}

// ── Exported db object (matches Firebase's modular API) ───────────────────────
export const db = {};

export { doc, collection, serverTimestamp, arrayUnion, setDoc, updateDoc, deleteDoc, where, query, onSnapshot };
