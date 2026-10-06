import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase, ref, onValue, get, set, remove, runTransaction, push
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, IS_CONFIGURED } from "./firebase-config.js";

let app = null;
let auth = null;
let db = null;

if (IS_CONFIGURED) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}

export { auth, db, ref, onValue, get, set, remove, runTransaction, push, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, IS_CONFIGURED };
