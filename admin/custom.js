// custom.js — Кастомизация главной страницы (исправлено 20.01.2026)
import { db } from "./firebase-config.js";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Функция получения значения поля с защитой от null
const getFieldValue = (id) => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
};

// Загрузка текущих значений из Firestore
onSnapshot(doc(db, "settings", "main"), snap => {
  const data = snap.exists() ? snap.data() : {};

  const setValueSafe = (id, defaultValue) => {
    const el = document.getElementById(id);
    if (el) el.value = data[id] || defaultValue;
  };

  setValueSafe("salon-name",       "Василики");
  setValueSafe("hero-description", "Идеальный маникюр в Москве");

  setValueSafe("sterility-text",   "Все инструменты проходят обработку и хранятся в индивидуальных крафт-пакетах");
  setValueSafe("experience-text",  "Более 3000 довольных клиенток — это наша лучшая рекомендация");
  setValueSafe("materials-text",   "Работаем исключительно с профессиональными брендами: Luxio, Luna, Kodi Professional");

  setValueSafe("map-title",        "Где я работаю");
  setValueSafe("cta-button-text",  "Записаться прямо сейчас");

  setValueSafe("footer-copyright", "© 2025–2026 Василики • Идеальный маникюр в Москве");
});

// Функция сохранения
const saveCustomTexts = async () => {
  const data = {
    salonName:       getFieldValue("salon-name"),
    heroDescription: getFieldValue("hero-description"),
    sterilityText:   getFieldValue("sterility-text"),
    experienceText:  getFieldValue("experience-text"),
    materialsText:   getFieldValue("materials-text"),
    mapTitle:        getFieldValue("map-title"),
    ctaButtonText:   getFieldValue("cta-button-text"),
    footerCopyright: getFieldValue("footer-copyright"),
    updatedAt:       serverTimestamp()
  };

  // Убираем пустые поля, чтобы не перезаписывать их null/пустой строкой
  Object.keys(data).forEach(key => {
    if (data[key] === "" && key !== "updatedAt") {
      delete data[key];
    }
  });

  try {
    await updateDoc(doc(db, "settings", "main"), data, { merge: true });
    if (window.adminToast) {
      adminToast("Все тексты главной страницы успешно обновлены!", "success");
    } else {
      alert("Тексты успешно сохранены!");
    }
  } catch (err) {
    if (window.adminToast) {
      adminToast("Ошибка при сохранении текстов", "error");
    } else {
      alert("Ошибка сохранения: " + err.message);
    }
    console.error("Ошибка сохранения кастомизации:", err);
  }
};

// Привязка события к кнопке
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("save-custom-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveCustomTexts);
  } else {
    console.warn("Кнопка с id='save-custom-btn' не найдена на странице");
  }
});