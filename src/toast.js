// src/toast.js — ТОАСТЫ

export const toast = (message, type = "info", duration = 3200) => {
  console.log(`%c🍞 ТОСТ: ${message}`, `color: ${type === 'error' ? '#ff5252' : '#4caf50'}; font-weight: bold;`);

  // Удаляем старый, если вдруг висит
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Форсируем reflow, чтоб анимация сработала
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, duration);
};

// Дополнительные шорткаты
toast.success = (msg) => toast(msg, "success");
toast.error   = (msg) => toast(msg, "error");
toast.warning = (msg) => toast(msg, "warning");
toast.info    = (msg) => toast(msg, "info");

// Глобально 
window.toast = toast;