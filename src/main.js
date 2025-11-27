// src/main.js — ФИНАЛЬНАЯ ВЕРСИЯ БЕЗ БАГОВ С КЛИКАМИ

import { store, subscribe } from "./store.js";
import { renderCalendar as originalRender } from "./calendar.js";
import { applyTheme } from "./utils.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { bookingsCol, servicesCol, auth } from "./firebase.js";

let pendingDate = null;

function openBookingModal(date) {
  if (store.isAdmin) {
    window.location.href = `/admin/admin.html?date=${date}`;
    return;
  }

  if (typeof window.showBookingModal === "function") {
    window.showBookingModal(date);
    pendingDate = null;
  } else {
    pendingDate = date;
  }
}

const checkModalReady = () => {
  if (typeof window.showBookingModal === "function" && pendingDate) {
    window.showBookingModal(pendingDate);
    pendingDate = null;
  } else if (!window.showBookingModal) {
    setTimeout(checkModalReady, 100);
  }
};
checkModalReady();

function enhancedRender() {
  originalRender();

  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // КЛИК РАБОТАЕТ ТОЛЬКО ПО РЕАЛЬНО ДОСТУПНЫМ ДНЯМ
  calendarEl.onclick = (e) => {
    const dayEl = e.target.closest(".day");
    if (!dayEl?.dataset?.date) return;

    const date = dayEl.dataset.date;
    const isPast = dayEl.classList.contains("past");
    const isBlocked = dayEl.classList.contains("blocked-full");
    const isFull = dayEl.classList.contains("booked"); // только если ВСЁ занято

    if (isPast || isBlocked || isFull) return;

    e.stopPropagation();
    openBookingModal(date);
  };

  // Курсор только на кликабельных
  calendarEl.querySelectorAll(".day:not(.past):not(.blocked-full):not(.booked)").forEach(cell => {
    cell.style.cursor = "pointer";
  });
}

subscribe(enhancedRender);

applyTheme(localStorage.getItem("theme") || "pink");

onSnapshot(bookingsCol, snap => {
  store.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  enhancedRender();
});

onSnapshot(servicesCol, snap => {
  store.services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

auth.onAuthStateChanged(user => {
  store.currentUser = user;
  store.isAdmin = !!user;
  console.log(user ? "%cАДМИН В СИСТЕМЕ" : "%cКЛИЕНТ", user ? "color:red" : "color:gray");
});

"serviceWorker" in navigator && navigator.serviceWorker.register("/calendar/sw.js");

setTimeout(enhancedRender, 200);