// src/main.js — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
import { store, subscribe } from "./store.js";
import { renderCalendar } from "./calendar.js";
import { applyTheme } from "./utils.js";
import { auth } from "./firebase.js";
import { updateGlobalMasterSelect } from "./components.js";

// Перерисовываем календарь при любом изменении store
subscribe(() => {
  renderCalendar();
});

// Тема
applyTheme(localStorage.getItem("theme") || "pink");

// Админ или нет
auth.onAuthStateChanged(user => {
  // Админ только если email в списке или localStorage superAdminAuth
  const isSuperAdmin = localStorage.getItem("superAdminAuth") === "true" ||
                       ["prointernat07@gmail.com", "admin@vasiliki.ru"].includes(user?.email);

  store.isAdmin = isSuperAdmin; // ← ТОЛЬКО ТАК!
  
  // Для обычных клиентов — НЕ админ!
  renderCalendar();
});


// Первый рендер
setTimeout(renderCalendar, 300);