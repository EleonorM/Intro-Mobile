import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBSMnN2hNtHDD3pVMcTinXk1OXD1KIOwQo",
  authDomain: "voetbal-veld.firebaseapp.com",
  projectId: "voetbal-veld",
  storageBucket: "voetbal-veld.firebasestorage.app",
  messagingSenderId: "309511308555",
  appId: "1:309511308555:web:906284761257924f8b4e0e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);