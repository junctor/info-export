import { doc, collection, getDoc, getDocs } from "firebase/firestore/lite";

function getFirestoreRoot(conferenceCode) {
  return ["conferences", conferenceCode];
}

export async function getConference(db, conferenceCode) {
  const docSnap = await getDoc(doc(db, ...getFirestoreRoot(conferenceCode)));
  if (!docSnap.exists())
    throw new Error(`Conference ${conferenceCode} not found`);
  return docSnap.data();
}

export async function fetchCollection(db, conferenceCode, collectionName) {
  const colRef = collection(
    db,
    ...getFirestoreRoot(conferenceCode),
    collectionName
  );
  const snap = await getDocs(colRef);
  return snap.docs.map((doc) => doc.data());
}
