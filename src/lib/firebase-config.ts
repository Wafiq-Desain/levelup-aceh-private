
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDiGpXu1TsPIa25Rm5N7OUTNCnfnAO8QTE",
  authDomain: "levelup-aceh-private.firebaseapp.com",
  projectId: "levelup-aceh-private",
  storageBucket: "levelup-aceh-private.firebasestorage.app",
  messagingSenderId: "489376624549",
  appId: "1:489376624549:web:a1d4009c382003fbc0824c",
  measurementId: "G-YRWP1N697E"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
