// src/main.js — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
import { store, subscribe } from "./store.js";
import { renderCalendar } from "./calendar.js";
import { applyTheme } from "./utils.js";
import { auth } from "./firebase.js";

// Перерисовываем календарь при любом изменении store
subscribe(() => {
  renderCalendar();
});

// Тема
applyTheme(localStorage.getItem("theme") || "pink");

// Админ или нет
auth.onAuthStateChanged(user => {
  store.isAdmin = !!user;
  renderCalendar();
});

// Первый рендер
setTimeout(renderCalendar, 300);