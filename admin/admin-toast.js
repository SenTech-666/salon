// src/admin-toast.js — ТОАСТЫ ДЛЯ АДМИНКИ, ЧТОБЫ ВЛАДЕЛЕЦ ЧУВСТВОВАЛ СЕБЯ КОРОЛЁМ
console.log("%cАДМИН-ТОАСТЫ ЗАГРУЖЕНЫ, ГОСПОДИН! Теперь ошибки будут красивыми", "color:gold;background:black;font-size:20px");

const adminToast = (message, type = "info", duration = 4000) => {
  // Создаём уникальный класс, чтобы не конфликтовать с клиентскими тостами
  const toast = document.createElement("div");
  toast.className = `admin-toast ${type}`;
  toast.textContent = message;

  // Стиль для админки — жирнее, заметнее, вверху справа
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.padding = "16px 24px";
  toast.style.borderRadius = "12px";
  toast.style.color = "white";
  toast.style.fontWeight = "bold";
  toast.style.fontSize = "1.1rem";
  toast.style.zIndex = "99999";
  toast.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-20px)";
  toast.style.transition = "all 0.4s ease";

  // Цвета под тип
  if (type === "success") toast.style.background = "#00c853";
  else if (type === "error") toast.style.background = "#ff5252";
  else if (type === "warning") toast.style.background = "#ff9800";
  else toast.style.background = "#2196f3"; // info

  document.body.appendChild(toast);

  // Анимация появления
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // Исчезновение
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => toast.remove(), 400);
  }, duration);
};

// Шорткаты для удобства
adminToast.success = (msg) => adminToast(msg, "success");
adminToast.error   = (msg) => adminToast(msg, "error");
adminToast.warning = (msg) => adminToast(msg, "warning");
adminToast.info    = (msg) => adminToast(msg, "info");

// Делаем глобальным для админки
window.adminToast = window.adminToast || adminToast; // на случай переопределения
console.log('adminToast успешно установлен в window', window.adminToast);