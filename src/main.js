// src/main.js
// Главный входной файл приложения — точка инициализации и координации основных модулей

import { store, subscribe } from "./store.js";
import { renderCalendar } from "./calendar.js";
import { applyTheme } from "./utils.js";
import { auth } from "./firebase.js";
import { updateGlobalMasterSelect } from "./components.js";

// Подписываемся на изменения глобального состояния (store)
// При любом обновлении данных автоматически перерисовываем календарь
subscribe(() => {
  renderCalendar();
});

// Применяем тему оформления
// По умолчанию используется тема "pink", если в localStorage ничего не сохранено
applyTheme(localStorage.getItem("theme") || "pink");

// Отслеживаем состояние аутентификации пользователя
auth.onAuthStateChanged(user => {
  // Определяем, является ли текущий пользователь супер-администратором
  // Проверяем либо флаг в localStorage, либо наличие email в списке разрешённых
  const isSuperAdmin = 
    localStorage.getItem("superAdminAuth") === "true" ||
    ["prointeres07@gmail.com", "admin@vasiliki.ru"].includes(user?.email);

  // Устанавливаем статус администратора в глобальном состоянии
  // Это единственный надёжный способ определения прав доступа
  store.isAdmin = isSuperAdmin;

  // Перерисовываем календарь с учётом прав текущего пользователя
  // Обычные клиенты всегда видят клиентскую версию интерфейса
  renderCalendar();
});

// Запускаем первый рендер календаря с небольшой задержкой
// Небольшой таймаут позволяет всем модулям и подпискам инициализироваться
setTimeout(renderCalendar, 300);

// Инициализация приложения завершена