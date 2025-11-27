// src/main.js — КЛИК РАБОТАЕТ ДАЖЕ ЕСЛИ МОДАЛКА ГРУЗИТСЯ ПОСЛЕДНЕЙ
import { store, subscribe } from "./store.js";
import { renderCalendar as originalRender } from "./calendar.js";
import { applyTheme } from "./utils.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { bookingsCol, servicesCol, auth } from "./firebase.js";

let pendingDate = null; // ← сюда будем складывать дату, если модалка ещё не готова

// === ОСНОВНАЯ ФУНКЦИЯ ОТКРЫТИЯ МОДАЛКИ ===
// === ОСНОВНАЯ ФУНКЦИЯ ОТКРЫТИЯ МОДАЛКИ (ФИНАЛЬНАЯ ВЕРСИЯ) ===
function openBookingModal(date) {
  // ЕСЛИ АДМИН — ОТКРЫВАЕМ АДМИНСКУЮ ПАНЕЛЬ, А НЕ КЛИЕНТСКУЮ МОДАЛКУ!
  if (store.isAdmin) {
    // Открываем отдельную страницу админки с выбранной датой
    window.location.href = `/admin/admin.html?date=${date}`;
    return;
  }

  // Клиент — открываем нормальную модалку
  if (typeof window.showBookingModal === "function") {
    console.log("%cМОДАЛКА ОТКРЫТА → " + date, "color: lime; font-weight: bold");
    window.showBookingModal(date);
    pendingDate = null;
  } else {
    console.warn("showBookingModal ещё нет, ждём... Дата в очереди:", date);
    pendingDate = date;
  }
}
// === Ждём, пока модалка появится и сразу открываем, если была очередь ===
const checkModalReady = () => {
  if (typeof window.showBookingModal === "function") {
    console.log("%cshowBookingModal загрузилась! Готов к работе", "color: gold");
    if (pendingDate) {
      console.log("Открываем отложенную дату:", pendingDate);
      window.showBookingModal(pendingDate);
      pendingDate = null;
    }
  } else {
    setTimeout(checkModalReady, 100);
  }
};
checkModalReady(); // запускаем проверку

// === РЕНДЕР С ЖЕЛЕЗНЫМ КЛИКОМ ===
function enhancedRender() {
  originalRender();

  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // Делегирование — ловим любой клик
  calendarEl.onclick = (e) => {
    const day = e.target.closest(".day:not(.past):not(.booked)");
    if (day && day.dataset?.date) {
      e.stopPropagation();
      console.log("%cКЛИК → " + day.dataset.date, "color: cyan");
      openBookingModal(day.dataset.date);
    }
  };

  // На всякий случай прямое навешивание
  calendarEl.querySelectorAll(".day:not(.past):not(.booked)").forEach(cell => {
    cell.style.cursor = "pointer";
    cell.onclick = (e) => {
      e.stopPropagation();
      openBookingModal(cell.dataset.date);
    };
  });
}

// Подписка на изменения
subscribe(enhancedRender);

// Firebase + тема + авторизация
applyTheme(localStorage.getItem("theme") || "pink");

onSnapshot(bookingsCol, snap => {
  store.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  enhancedRender();
});
onSnapshot(servicesCol, snap => store.services = snap.docs.map(d => ({ id: d.id, ...d.data() })));

auth.onAuthStateChanged(user => {
  store.currentUser = user;
  store.isAdmin = !!user;  // ← ЭТО ОБЯЗАТЕЛЬНО, СУКА!!!

  const adminBtn = document.querySelector(".admin-controls");
  if (adminBtn) adminBtn.style.display = user ? "block" : "none";

  console.log(user ? "%cАДМИН ЗАШЁЛ — РЕЖИМ БОГА АКТИВИРОВАН" : "%cОбычный смертный", 
              user ? "color: red; font-weight: bold" : "color: gray");
});

// PWA
"serviceWorker" in navigator && navigator.serviceWorker.register("/calendar/sw.js");

// Первый рендер
setTimeout(enhancedRender, 200);