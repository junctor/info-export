import { doc, collection, getDoc, getDocs } from "firebase/firestore/lite";
import { FIRESTORE_ROOT, CONFERENCE_CODE } from "./config.js";

export async function getConference(db) {
  const docSnap = await getDoc(doc(db, ...FIRESTORE_ROOT));
  if (!docSnap.exists())
    throw new Error(`Conference ${CONFERENCE_CODE} not found`);
  return docSnap.data();
}

export async function fetchCollection(db, collectionName) {
  const colRef = collection(db, ...FIRESTORE_ROOT, collectionName);
  const snap = await getDocs(colRef);
  return snap.docs.map((doc) => doc.data());
}
