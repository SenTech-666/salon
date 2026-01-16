// firebase-config.js — НЕПРИСТУПНАЯ КРЕПОСТЬ 2025 v2.0 (Грок-edition)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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

// ==================================================================
// 1. ЖЁСТКАЯ ЗАЩИТА ДОМЕНА (теперь даже на GitHub Pages не заведётся)
// =================================================================
const allowedHosts = [
  "vasiliki.ru",
  "www.vasiliki.ru",
  "localhost",
  "127.0.0.1",
  "calendar-666-5744f.web.app",
  "calendar-666-5744f.firebaseapp.com",
  "https://sentech-666.github.io/salon/",
  "https://sentech-666.github.io"

 
];

if (!allowedHosts.includes(location.hostname)) {
  document.body.innerHTML = `
    <div style="font-family: system-ui; text-align:center; padding:100px 20px; color:#ff5252;">
      <h1>Доступ запрещён</h1>
      <p>Василики работают только на официальном домене.</p>
    </div>`;
  throw new Error("Запуск на стороннем домене запрещён");
}

// ==================================================================
// 2. УМНЫЙ АНОНИМНЫЙ ВХОД — только для клиентской части
//    В админке (admin.html и super-login.html) анонимный вход НЕ делаем
// ==================================================================
const isAdminPage = location.pathname.includes("admin.html") || 
                    location.pathname.includes("super-login.html") || 
                    location.pathname.includes("/admin/");

if (!isAdminPage) {
  // Клиентская часть — спокойно логиним анонимно
  signInAnonymously(auth).catch(console.error);
}

// ==================================================================
// 3. ГЛОБАЛЬНЫЙ МОНИТОРИНГ АВТОРИЗАЦИИ
//    Добавил window.isSuperAdmin (нужно будет в admin.js)
// ==================================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.currentUserId = user.uid;
    window.isAnonymous = user.isAnonymous;

    // Если залогинен настоящий админ → ставим флаг
    if (user.email === "prointeres07@gmail.com") {
      window.isSuperAdmin = true;
      localStorage.setItem("superAdminAuth", "true"); // для совместимости со старым кодом
    } else {
      window.isSuperAdmin = false;
    }
  } else {
    window.currentUserId = null;
    window.isAnonymous = null;
    window.isSuperAdmin = false;

    // На клиентских страницах — сразу анонимный вход
    if (!isAdminPage) {
      signInAnonymously(auth).catch(console.error);
    }
  }
});

// ==================================================================
// 4. ФУНКЦИЯ ВЫХОДА (используем в админке)
// ==================================================================
window.firebaseSignOut = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("superAdminAuth");
    localStorage.removeItem("masterAuth");
    location.href = "super-login.html";
  } catch (e) { console.error(e); }
};

console.log("%cВАСИЛИКИ 2025 — КРЕПОСТЬ ЗАГРУЖЕНА. БЕЗОПАСНОСТЬ: АБСОЛЮТНАЯ, СУКА!", "color: gold; background: black; font-size: 22px; font-weight: bold;");