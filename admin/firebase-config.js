// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCr08aVXswvpjwwLvtSbpBnPhE8dv3HWdM",
  authDomain: "calendar-666-5744f.firebaseapp.com",
  projectId: "calendar-666-5744f",
  storageBucket: "calendar-666-5744f.appspot.com",
  messagingSenderId: "665606748855",
  appId: "1:665606748855:web:5e4a2865b1f26494cf2b32"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export { app };