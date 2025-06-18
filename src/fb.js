import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore/lite";
import { getBytes, getStorage, ref } from "firebase/storage";

const conference = "DEFCON33";

export async function getConferences(db, count = 10) {
  const docRef = collection(db, "conferences");
  const q = query(docRef, orderBy("updated_at", "desc"), limit(count));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((eventsDoc) => eventsDoc.data());

  return firebaseData;
}

export async function getEvents(db) {
  const docRef = collection(db, "conferences", conference, "events");
  const q = query(docRef, orderBy("begin_timestamp", "asc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((eventsDoc) => eventsDoc.data());

  return firebaseData;
}

export async function getTags(db) {
  const docRef = collection(db, "conferences", conference, "tagtypes");
  const docSnap = await getDocs(docRef);
  const firebaseData = docSnap.docs.flatMap((tagsDoc) => tagsDoc.data()) ?? [];

  return firebaseData;
}

export async function getSpeakers(db) {
  const docRef = collection(db, "conferences", conference, "speakers");
  const docSnap = await getDocs(docRef);
  const firebaseData = docSnap.docs.map((speakerDoc) => speakerDoc.data());

  return firebaseData;
}

export async function getLocations(db) {
  const docRef = collection(db, "conferences", conference, "locations");
  const docSnap = await getDocs(docRef);
  const firebaseData = docSnap.docs.map((speakerDoc) => speakerDoc.data());

  return firebaseData;
}

export async function getConference(db) {
  const docRef = collection(db, "conferences");
  const q = query(docRef, where("code", "==", conference));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((eventsDoc) => eventsDoc.data());

  return firebaseData[0];
}

export async function getNews(db) {
  const docRef = collection(db, "conferences", conference, "articles");
  const q = query(docRef, orderBy("id", "desc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((newsDoc) => newsDoc.data());

  return firebaseData;
}

export async function getFbStorage(db, file) {
  const storage = getStorage(db.app);
  const pathReference = ref(storage, `${conference}/${file}`);
  const bytes = await getBytes(pathReference);
  return {
    file,
    bytes,
  };
}

export async function getOrganizations(db) {
  const docRef = collection(db, "conferences", conference, "organizations");
  const q = query(docRef, orderBy("id", "desc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((orgDoc) => orgDoc.data());

  return firebaseData;
}

export async function getDocuments(db) {
  const docRef = collection(db, "conferences", conference, "documents");
  const q = query(docRef, orderBy("id", "desc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((doc) => doc.data());

  return firebaseData;
}

export async function getMenus(db) {
  const docRef = collection(db, "conferences", conference, "menus");
  const q = query(docRef, orderBy("id", "desc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((doc) => doc.data());

  return firebaseData;
}

export async function getContent(db) {
  const docRef = collection(db, "conferences", conference, "content");
  const q = query(docRef, orderBy("id", "desc"));
  const docSnap = await getDocs(q);
  const firebaseData = docSnap.docs.map((doc) => doc.data());

  return firebaseData;
}
