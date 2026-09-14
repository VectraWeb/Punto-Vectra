// firebase/firestore shim — Re-exports from our firebase.js shim
export {
  doc,
  collection,
  serverTimestamp,
  arrayUnion,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  query,
  onSnapshot,
} from '../firebase.js';
