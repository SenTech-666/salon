// src/components.js — ФИНАЛЬНАЯ ВЕРСИЯ 27.11.2025 + ФИКС ДЛИТЕЛЬНОСТИ УСЛУГИ ПРИ СМЕНЕ

console.log("%ccomponents.js — ПОЛНОСТЬЮ ЗАНЯТЫЙ ДЕНЬ = НЕ ОТКРОЕТСЯ НИКОГДА", "color: red; font-size: 22px; font-weight: bold");

import { store } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db } from "./firebase.js";
import { collection, onSnapshot, query, where, getDocs, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let services = [];
let clientId = localStorage.getItem('clientId') || 'temp_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('clientId', clientId);

const blockedCol = collection(db, "blocked");
const bookingsCol = collection(db, "bookings");

// Реал-тайм подписки
onSnapshot(blockedCol, snap => {
  store.blocked = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (window.currentModalDate) openClientModal(window.currentModalDate);
});

onSnapshot(bookingsCol, snap => {
  store.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (window.currentModalDate) openClientModal(window.currentModalDate);
});

onSnapshot(collection(db, "services"), snap => {
  services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  forceUpdateClientSelect(); // ← перерисовываем селект
});

// === ГЛАВНАЯ ПРОВЕРКА ПЕРЕД ОТКРЫТИЕМ ===
window.showBookingModal = (dateISO) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return toast("Ошибка даты", "error");

  const isFullyBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay === true);
  if (isFullyBlocked && !store.isAdmin) {
    return toast("Этот день закрыт мастером", "error");
  }

  const isDayFullyBooked = () => {
    const allSlots = [];
    for (let h = 10; h <= 20; h++) {
      allSlots.push(`${h.toString().padStart(2, "0")}:00`);
      if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
    }

    return allSlots.every(time => {
      const blocked = store.blocked.some(b => b.date === dateISO && b.time === time);
      if (blocked) return true;

      return store.bookings.some(b => {
        if (b.date !== dateISO) return false;
        const [h1, m1] = time.split(":").map(Number);
        const slotStart = h1 * 60 + m1;
        const [h2, m2] = b.time.split(":").map(Number);
        const bookStart = h2 * 60 + m2;
        const bookEnd = bookStart + (b.duration || 60);
        return slotStart >= bookStart && slotStart < bookEnd;
      });
    });
  };

  if (isDayFullyBooked() && !store.isAdmin) {
    return toast("На этот день уже нет свободного времени", "error");
  }

  if (store.isAdmin) {
    window.location.href = `/admin/admin.html?date=${dateISO}`;
  } else {
    openClientModal(dateISO);
  }
};

let currentModalDate = null;
window.currentModalDate = null;

const openClientModal = (dateStr) => {
  currentModalDate = dateStr;
  window.currentModalDate = dateStr;

  const isDayFullyBlocked = store.blocked.some(b => b.date === dateStr && b.fullDay === true);
  if (isDayFullyBlocked) {
    closeModal();
    toast("День закрыт мастером", "error");
    return;
  }

  const dateRu = dateStr.split("-").reverse().join(".");

  const allSlots = [];
  for (let h = 10; h <= 20; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  // Находим СВОЮ запись в этот день (если есть)
  const ownBooking = store.bookings.find(b => 
    b.date === dateStr && b.clientId === clientId
  );

  const timeGrid = allSlots.map(time => {
    const blocked = store.blocked.some(b => b.date === dateStr && b.time === time);
    const bookedBySomeone = store.bookings.some(b => {
      if (b.date !== dateStr) return false;
      const [h1, m1] = time.split(":").map(Number);
      const slotStart = h1 * 60 + m1;
      const [h2, m2] = b.time.split(":").map(Number);
      const bookStart = h2 * 60 + m2;
      const bookEnd = bookStart + (b.duration || 60);
      return slotStart >= bookStart && slotStart < bookEnd;
    });

    // Проверяем — это НАША запись?
    const isOwnSlot = ownBooking && (() => {
      const [h1, m1] = time.split(":").map(Number);
      const slotStart = h1 * 60 + m1;
      const [h2, m2] = ownBooking.time.split(":").map(Number);
      const ownStart = h2 * 60 + m2;
      const ownEnd = ownStart + (ownBooking.duration || 60);
      return slotStart >= ownStart && slotStart < ownEnd;
    })();

    let classes = "time-slot-old";
    let text = time;
    let onclick = "";

    if (isOwnSlot) {
      classes += " own-booking";
      text = "Запись";
      onclick = `onclick="toast('У вас уже есть запись на это время', 'info')"`;
    } else if (blocked) {
      classes += " blocked";
      text = "Закрыто";
      onclick = `onclick="toast('Время закрыто мастером', 'error')"`;
    } else if (bookedBySomeone) {
      classes += " booked";
      text = "Занято";
      onclick = `onclick="toast('Время уже занято', 'error')"`;
    } else {
      classes += " free";
      onclick = `onclick="selectTime('${time}', this)"`;
    }

    return `<div class="${classes}" ${onclick}>${text}</div>`;
  }).join("");

  showModal(`
    <h3>Запись на ${dateRu}</h3>
    <p style="color:var(--text-light);margin:20px 0 12px">Выберите время:</p>
    <div class="time-grid-old">${timeGrid}</div>

    <div id="selectedTimeInfo" style="display:none;margin:28px 0 16px;font-size:1.2rem;font-weight:600;color:var(--accent)">
      Выбрано: <span id="chosenTime"></span>
    </div>

    <input type="text" id="clientName" placeholder="Ваше имя" style="display:none" required>
    <input type="tel" id="clientPhone" placeholder="Телефон +7" value="+7" style="display:none" required>
    <select id="service" style="display:none" required></select>

    <div id="finalStep" style="display:none;margin-top:32px">
      <button class="main" onclick="bookAppointment()">Записаться</button>
    </div>

    <div id="instantSuccess" style="display:none;text-align:center;margin-top:40px">
      <div style="font-size:4.5rem;margin:20px 0">Успешно!</div>
      <p style="font-size:1.5rem;color:var(--accent);line-height:1.4">
        Вы записаны!<br>
        <span id="successDetails"></span>
      </p>
      <p style="margin-top:30px;color:var(--text-light);font-size:1rem">
        Закроется автоматически...
      </p>
    </div>

    <p style="margin-top:28px;color:var(--text-light);font-size:0.92rem">
      Подтвердим запись в течение часа
    </p>
  `);

  setTimeout(() => {
    forceUpdateClientSelect();
  }, 120);
};

// === КЛЮЧЕВОЙ ФИКС: обновление длительности при смене услуги ===
window.selectTime = (time, el) => {
  const stillFree = !store.blocked.some(b => b.date === currentModalDate && (b.time === time || b.fullDay === true))
    && !store.bookings.some(b => {
      if (b.date !== currentModalDate) return false;
      const [h1, m1] = time.split(":").map(Number);
      const start = h1 * 60 + m1;
      const [h2, m2] = b.time.split(":").map(Number);
      const bStart = h2 * 60 + m2;
      const bEnd = bStart + (b.duration || 60);
      return start >= bStart && start < bEnd;
    });

  if (!stillFree) {
    toast("Это время уже занято", "error");
    openClientModal(currentModalDate);
    return;
  }

  document.querySelectorAll('.time-slot-old').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  window.selectedTimeForBooking = time;

  // Показываем поля и сразу обновляем текст с длительностью
  document.getElementById('selectedTimeInfo').style.display = 'block';
  document.getElementById('clientName').style.display = 'block';
  document.getElementById('clientPhone').style.display = 'block';
  document.getElementById('service').style.display = 'block';
  document.getElementById('finalStep').style.display = 'block';

  updateSelectedTimeInfo(); // ← сразу покажем (даже если услуга ещё не выбрана)
  document.getElementById('clientName').focus();
};

window.bookAppointment = async () => {
  const time = window.selectedTimeForBooking;
  if (!time) return toast("Выберите время!", "error");

  const name = document.getElementById("clientName").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const serviceId = document.getElementById("service").value;
  if (!name || !phone || !serviceId) return toast("Заполните все поля!", "error");

  const service = services.find(s => s.id === serviceId);
  if (!service) return toast("Услуга не найдена", "error");

  document.getElementById("finalStep").style.display = "none";
  document.getElementById("instantSuccess").style.display = "block";
  document.getElementById("successDetails").textContent = 
    `${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в ${time} • ${service.name}`;

  const booking = {
    date: currentModalDate,
    time,
    clientName: name,
    clientPhone: phone,
    clientId,
    serviceId,
    serviceName: service.name,
    duration: service.duration,
    price: service.price,
    createdAt: new Date().toISOString()
  };

  try {
    await addBooking(booking);
    await sendTelegramNotification(booking);
    toast("Вы записаны!", "success");
    setTimeout(() => closeModal(), 2800);
  } catch (e) {
    console.error(e);
    toast("Ошибка сети", "error");
    document.getElementById("finalStep").style.display = "block";
    document.getElementById("instantSuccess").style.display = "none";
  }
};

// === ОБНОВЛЕНИЕ СЕЛЕКТА + ПОВЕШИВАНИЕ change ===
function forceUpdateClientSelect() {
  const select = document.getElementById("service");
  if (!select) return;

  const prevValue = select.value;

  select.innerHTML = `<option value="">Выберите услугу</option>` +
    services.map(s => `
      <option value="${s.id}" ${s.id === prevValue ? "selected" : ""}>
        ${s.name} — ${s.price}₽ (${s.duration} мин)
      </option>
    `).join("");

  // САМОЕ ГЛАВНОЕ: вешаем обработчик смены услуги
  select.addEventListener("change", updateSelectedTimeInfo);

  // Если время уже выбрано — сразу обновляем текст
  if (window.selectedTimeForBooking) {
    updateSelectedTimeInfo();
  }
}

// === Функция обновления текста "Выбрано: 17:00 (120 мин)" ===
function updateSelectedTimeInfo() {
  const select = document.getElementById("service");
  const timeEl = document.getElementById("chosenTime");
  if (!select || !timeEl || !window.selectedTimeForBooking) return;

  const service = services.find(s => s.id === select.value);
  const duration = service ? service.duration : 60;

  timeEl.textContent = `${window.selectedTimeForBooking} (${duration} мин)`;
}

window.blockDay = async (dateStr) => {
  if (confirm("Заблокировать весь день?")) {
    await addDoc(blockedCol, { date: dateStr, fullDay: true });
    toast("День заблокирован", "info");
  }
};

window.showBookingModal = showBookingModal;
window.closeModal = closeModal;

console.log("%cФИКС: Теперь при смене услуги — длительность обновляется мгновенно! Мобилька — огонь!", "color: lime; font-size: 20px; font-weight: bold");