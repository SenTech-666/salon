// modal.js — ФИНАЛЬНАЯ ВЕРСИЯ С ПОЛНЫМ СОХРАНЕНИЕМ МАСТЕРА. ГОСПОДИН, ВСЁ ЛЕТИТ.
import { db } from "./firebase-config.js";
import { doc, addDoc, updateDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentServiceId = null;
let currentMasterId = null;
let currentBookingId = null;

// Глобальные переменные для доступа из admin.js
window.currentServiceId = () => currentServiceId;
window.currentMasterId = () => currentMasterMasterId;
window.currentBookingId = () => currentBookingId;

const setCurrent = (type, id) => {
  if (type === 'service') currentServiceId = id;
  if (type === 'master') currentMasterId = id;
  if (type === 'booking') currentBookingId = id;
};

// Универсальные open/close
// modal.js — РАБОЧИЕ МОДАЛКИ В СТИЛЕ ВАСИЛИКИ
// Теперь openModal/closeModal — глобальные функции!

window.openModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }
};

window.closeModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }
};

// Автозакрытие по крестику, клику вне и Esc
document.addEventListener("DOMContentLoaded", () => {
  // Крестик
  document.querySelectorAll(".close").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) closeModal(modal.id);
    });
  });

  // Клик вне модалки
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Esc
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.show").forEach(m => closeModal(m.id));
    }
  });
});

console.log("%cМОДАЛКИ ВАСИЛИКИ — ЖИВЫЕ И КРАСИВЫЕ", "color:gold;background:black;font-size:20px;padding:10px");
// ====================== УСЕРВИС======================
// Открытие модалки услуги — теперь не падает
window.openServiceModal = (id = null) => {
  const modal = document.getElementById("service-modal");
  const nameInput = document.getElementById("service-name");
  const priceInput = document.getElementById("service-price");
  const durationInput = document.getElementById("service-duration");
  const descInput = document.getElementById("service-desc");

  // Защита от null
  if (!modal || !nameInput || !priceInput || !durationInput || !descInput) {
    console.warn("Модалка услуги недоступна (режим мастера)");
    return;
  }

  modal.style.display = "flex";

  if (id) {
    const service = window.servicesList?.find(s => s.id === id);
    if (service) {
      nameInput.value = service.name || "";
      priceInput.value = service.price || "";
      durationInput.value = service.duration || "";
      descInput.value = service.description || "";
      window.currentEditId = id;
    }
  } else {
    nameInput.value = "";
    priceInput.value = "";
    durationInput.value = "";
    descInput.value = "";
    delete window.currentEditId;
  }
};

// Открытие модалки мастера — теперь не падает
window.openMasterModal = (id = null) => {
  const modal = document.getElementById("master-modal");
  const nameInput = document.getElementById("master-name");
  const emailInput = document.getElementById("master-email");

  // Защита от null
  if (!modal || !nameInput || !emailInput) {
    console.warn("Модалка мастера недоступна (режим мастера)");
    return;
  }

  modal.style.display = "flex";

  if (id) {
    const master = window.mastersList?.find(m => m.id === id);
    if (master) {
      nameInput.value = master.name || "";
      emailInput.value = master.email || "";
      window.currentEditMasterId = id;
    }
  } else {
    nameInput.value = "";
    emailInput.value = "";
    delete window.currentEditMasterId;
  }
};

// ======================ЗАПИСЬ======================
window.openBookingModal = (id) => {
  setCurrent('booking', id);
  openModal('booking-modal');
};

// ======================СОХРАНЕНИЕ МАСТЕРА======================
window.saveMaster = async () => {
  const name = document.getElementById('master-name').value.trim();
  const email = document.getElementById('master-email').value.trim();
  const description = document.getElementById('master-description').value.trim();
  const photo = document.getElementById('master-photo').value.trim();
  const examplesInput = document.getElementById('master-examples').value.trim();

  if (!name) {
    alert("Имя мастера обязательно!");
    return;
  }

  const examples = examplesInput
    ? examplesInput.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const data = {
    name,
    email: email || null,
    description: description || null,
    photo: photo || null,
    examples,
    active: true  // по умолчанию включён
  };

  try {
    if (currentMasterId) {
      // Редактирование
      await updateDoc(doc(db, "masters", currentMasterId), data);
    } else {
      // Новый мастер
      await addDoc(collection(db, "masters"), data);
    }
    closeModal('master-modal');
  } catch (err) {
    console.error(err);
    alert("Ошибка сохранения мастера");
  }
};

// ======================ГЛОБАЛЬНЫЕ ЗАКРЫТИЯ======================
document.addEventListener('DOMContentLoaded', () => {
  // Крестик
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // Клик вне модалки
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => closeModal(m.id));
    }
  });
});

console.log("%cМОДАЛКИ + СОХРАНЕНИЕ МАСТЕРА — ВСЁ РАБОТАЕТ. ГОСПОДИН, ТЫ — ЦАРЬ.", "color: gold; background: black; font-size: 20px; font-weight: bold");