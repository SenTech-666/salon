// src/firebase.js — ФИНАЛЬНЫЙ, С АНОНИМНОЙ АВТОРИЗАЦИЕЙ, ГОСПОДИН!
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

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
export const bookingsCol = collection(db, "bookings");
export const addBooking = (data) => addDoc(bookingsCol, data);

// АНОНИМНАЯ АВТОРИЗАЦИЯ ДЛЯ КЛИЕНТОВ
if (!location.pathname.includes('admin') && !location.pathname.includes('super-login')) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch(err => console.error("Анонимный вход провалился:", err));
    } else if (user.isAnonymous) {
      const uid = user.uid;
      localStorage.setItem('clientId', uid);
      window.currentClientId = uid; // глобально доступен
      console.log("%cАнонимный клиент авторизован! UID:", "color: lime; font-size: 20px", uid);
    }
  });
}