// src/firebase.js
// Модуль инициализации и конфигурации Firebase
// Обеспечивает подключение к Firestore и аутентификацию

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Конфигурация проекта Firebase
// Эти параметры получены из консоли Firebase и необходимы для подключения
const firebaseConfig = {
  apiKey: "AIzaSyCr08aVXswvpjwwLvtSbpBnPhE8dv3HWdM",
  authDomain: "calendar-666-5744f.firebaseapp.com",
  projectId: "calendar-666-5744f",
  storageBucket: "calendar-666-5744f.appspot.com",
  messagingSenderId: "665606748855",
  appId: "1:665606748855:web:5e4a2865b1f26494cf2b32"
};

// Инициализация приложения Firebase
const app = initializeApp(firebaseConfig);

// Экспорт основных сервисов
export const db = getFirestore(app);
export const auth = getAuth(app);

// Коллекция для хранения записей клиентов
export const bookingsCol = collection(db, "bookings");

// Удобная функция для добавления новой записи
export const addBooking = (data) => addDoc(bookingsCol, data);

// Анонимная аутентификация для обычных клиентов
// Выполняется только на клиентских страницах (не на страницах админки)
if (!location.pathname.includes('admin') && !location.pathname.includes('super-login')) {
  onAuthStateChanged(auth, (user) => {
    // Если пользователь не авторизован — выполняем анонимный вход
    if (!user) {
      signInAnonymously(auth)
        .catch(err => console.error("Ошибка анонимной аутентификации:", err));
    }
    // Если пользователь успешно вошёл анонимно — сохраняем его UID
    else if (user.isAnonymous) {
      const uid = user.uid;
      localStorage.setItem('clientId', uid);
      window.currentClientId = uid; // Делаем UID доступным глобально для других модулей

      // Отладочная информация (можно убрать в production)
      console.log("%cАнонимный клиент успешно авторизован. UID:", "color: lime; font-size: 16px", uid);
    }
  });
}

// Модуль полностью готов к использованию в production