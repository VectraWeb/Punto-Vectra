import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const staffCol = () => collection(db, 'staff');

export function useStaff() {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(staffCol(), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return staff;
}
