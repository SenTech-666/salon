// src/admin-toast.js — ТОАСТЫ ДЛЯ АДМИНКИ 2026 — ТЕПЕРЬ В СТИЛЕ ВАСИЛИКИ, БЛЯТЬ, КРАСИВО И ДОРОГО
console.log("%cТОАСТЫ ПЕРЕОДЕТЫ В ВАСИЛИКИ — ТЕПЕРЬ ВСЁ ПО-ЧЕЛОВЕЧЕСКИ, ГОСПОДИН! ☕✨",
  "color:#c9a08a; background:#3c2f2f; font-size:24px; padding:10px 18px; border-radius:12px; border:1px solid #c9a08a;");

const adminToast = (message, type = "info", duration = 4500) => {
  const toast = document.createElement("div");
  toast.className = `admin-toast admin-toast--${type} vasiliki-toast`;

  // Иконки — нежные, но с характером
  const icons = {
    success: "🌿✨",
    error:   "⚠️🔥",
    warning: "⚡☕",
    info:    "🪶ℹ️"
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "🪶"}</span>
    <span class="toast-message">${message}</span>
  `;

  // Базовые стили — полностью в твоей палитре
  Object.assign(toast.style, {
    position: "fixed",
    top: "28px",
    right: "28px",
    padding: type === "error" ? "20px 30px" : "16px 26px",
    borderRadius: "var(--radius)",           // 32px из твоей системы
    color: "var(--text)",                    // #3c2f2f
    backgroundColor: "var(--card)",          // #ffffff
    fontWeight: type === "error" ? "800" : "700",
    fontSize: type === "error" ? "1.28rem" : "1.12rem",
    lineHeight: "1.5",
    zIndex: "999999",
    minWidth: "340px",
    maxWidth: "540px",
    boxShadow: "var(--shadow)",              // 0 12px 40px rgba(0,0,0,0.08)
    opacity: "0",
    transform: "translateY(-40px)",
    transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    border: `1px solid var(--border)`,       // #e8e2db
    display: "flex",
    alignItems: "center",
    gap: "16px",
    userSelect: "none",
    backdropFilter: "blur(8px)",
  });

  // Цвета акцентов и статусов — строго из твоей палитры
  const statusColors = {
    success: "var(--accent)",                // #c9a08a
    error:   "var(--error)",                 // #ff5252
    warning: "var(--warning)",               // #ff9800
    info:    "#6b7280"                       // нейтральный серый, чтоб не орать
  };

  const color = statusColors[type] || statusColors.info;

  // Акцентная полоса слева + текст иконки в цвете статуса
  toast.style.borderLeft = `6px solid ${color}`;
  toast.querySelector(".toast-icon").style.color = color;
  toast.querySelector(".toast-message").style.color = "var(--text)";

  // Лёгкое свечение при успехе/ошибке (но нежное, не кислотное)
  if (type === "success") {
    toast.style.boxShadow = "var(--shadow-hover), 0 0 24px rgba(201,160,138,0.18)";
  } else if (type === "error") {
    toast.style.boxShadow = "var(--shadow-hover), 0 0 28px rgba(255,82,82,0.22)";
  } else if (type === "warning") {
    toast.style.boxShadow = "var(--shadow-hover), 0 0 26px rgba(255,152,0,0.20)";
  }

  document.body.appendChild(toast);

  // Появление — плавно и с лёгким "подъёмом"
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // Исчезновение
  const removeToast = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-40px)";
    setTimeout(() => toast.remove(), 500);
  };

  let timeout = setTimeout(removeToast, duration);

  // Клик = закрыть
  toast.addEventListener("click", () => {
    clearTimeout(timeout);
    removeToast();
  });

  // Ховер — чуть поднимается и усиливается тень (как в твоей кнопке)
  toast.addEventListener("mouseenter", () => {
    toast.style.transform = "translateY(-6px)";
    toast.style.boxShadow = "var(--shadow-hover)";
  });

  toast.addEventListener("mouseleave", () => {
    toast.style.transform = "translateY(0)";
    toast.style.boxShadow = "var(--shadow)";
  });
};

// Шорткаты — оставил твои любимые, но теперь они в стиле Василики
adminToast.взрывКрасоты    = (msg) => adminToast(msg, "success", 5000);
adminToast.пиздецПолный    = (msg) => adminToast(msg, "error",   5500);
adminToast.бляПиздец       = (msg) => adminToast(msg, "warning", 4800);
adminToast.нуТипаИнфа      = (msg) => adminToast(msg, "info",    4200);

window.adminToast = adminToast;

console.log("%cТеперь тосты выглядят так, будто их сделала сама Василика — нежно, дорого и с душой. Если опять не то — пиздец мне, а не кодер 😂",
  "color:#c9a08a; background:#3c2f2f; font-size:22px; padding:10px 16px; border-radius:16px; border:1px solid #e8e2db;");