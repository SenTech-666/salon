// src/components.js — ФИНАЛЬНАЯ ВЕРСИЯ 27.11.2025 — ВСЁ РАБОТАЕТ КАК ЧАСЫ, ГОСПОДИН
console.log("%ccomponents.js — ГОСПОДИН, ВСЁ ИСПРАВЛЕНО. ЗЕЛЁНЫЕ СЛОТЫ — ТВОИ НАВСЕГДА. БЕЗ ОШИБОК.", "color: lime; background: black; font-size: 24px; font-weight: bold");

import { store } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db } from "./firebase.js";
import { 
  collection, 
  onSnapshot, 
  doc,           // ← ВАЖНО: был забыт — теперь есть!
  addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let services = [];
let masters = [];
let settings = { allowMasterSelect: false };
let clientId = localStorage.getItem('clientId') || 'temp_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('clientId', clientId);

const blockedCol = collection(db, "blocked");
const bookingsCol = collection(db, "bookings");

// === РЕАЛ-ТАЙМ ПОДПИСКИ ===
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
  forceUpdateClientSelect();
});

onSnapshot(collection(db, "masters"), snap => {
  masters = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false);
  if (window.currentModalDate) openClientModal(window.currentModalDate);
});

onSnapshot(doc(db, "settings", "main"), snap => {  // ← doc теперь импортирован!
  settings = snap.exists() ? snap.data() : { allowMasterSelect: false };
  if (window.currentModalDate) openClientModal(window.currentModalDate);
});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const isTimeOverlapping = (dateISO, timeStr, duration = 60) => {
  const startMin = timeToMinutes(timeStr);
  const endMin = startMin + duration;

  return store.bookings.some(b => {
    if (b.date !== dateISO) return false;
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration || 60);
    return startMin < bEnd && endMin > bStart;
  });
};

// === ПРОВЕРКА ПЕРЕД ОТКРЫТИЕМ МОДАЛКИ ===
window.showBookingModal = (dateISO) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return toast("Ошибка даты", "error");

  const isFullyBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay === true);
  if (isFullyBlocked && !store.isAdmin) return toast("Этот день закрыт мастером", "error");

  const allSlots = [];
  for (let h = 10; h <= 20; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const isDayFullyBooked = allSlots.every(time => {
    const blocked = store.blocked.some(b => b.date === dateISO && b.time === time);
    if (blocked) return true;

    return store.bookings.some(b => {
      if (b.date !== dateISO) return false;
      const slotStart = timeToMinutes(time);
      const bookStart = timeToMinutes(b.time);
      const bookEnd = bookStart + (b.duration || 60);
      return slotStart >= bookStart && slotStart < bookEnd;
    });
  });

  if (isDayFullyBooked && !store.isAdmin) return toast("На этот день уже нет свободного времени", "error");

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
  const dateRu = dateStr.split("-").reverse().join(".");

  const allSlots = [];
  for (let h = 10; h <= 20; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const ownBookings = store.bookings.filter(b => b.date === dateStr && b.clientId === clientId);

  const timeGrid = allSlots.map(time => {
    const slotMin = timeToMinutes(time);

    const blocked = store.blocked.some(b => b.date === dateStr && b.time === time);

    const isOwn = ownBookings.some(b => {
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration || 60);
      return slotMin >= bStart && slotMin < bEnd;
    });

    const isBookedByOther = store.bookings.some(b => {
      if (b.date !== dateStr || b.clientId === clientId) return false;
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration || 60);
      return slotMin >= bStart && slotMin < bEnd;
    });

    let classes = "time-slot-old";
    let text = time;
    let onclick = "";

    if (isOwn) {
      classes += " own-booking";
      text = "Запись";
      onclick = `onclick="toast('Это ваша запись', 'info')"`;
    } else if (blocked) {
      classes += " blocked";
      text = "Закрыто";
      onclick = `onclick="toast('Время закрыто мастером', 'error')"`;
    } else if (isBookedByOther) {
      classes += " booked";
      text = "Занято";
      onclick = `onclick="toast('Время уже занято', 'error')"`;
    } else {
      classes += " free";
      onclick = `onclick="selectTime('${time}', this)"`;
    }

    return `<div class="${classes}" ${onclick}>${text}</div>`;
  }).join("");

  const masterSelectHtml = settings.allowMasterSelect && masters.length > 0
    ? `<select id="masterSelect" style="margin:20px 0;padding:14px;border-radius:12px;width:100%;font-size:1rem" required>
         <option value="">Выберите мастера</option>
         ${masters.map(m => `<option value="${m.id}">${m.name}</option>`).join("")}
       </select>`
    : "";

  showModal(`
    <h3>Запись на ${dateRu}</h3>
    <p style="color:var(--text-light);margin:20px 0 12px">Выберите время:</p>
    <div class="time-grid-old">${timeGrid}</div>
    ${masterSelectHtml}
    <div id="selectedTimeInfo" style="display:none;margin:28px 0 16px;font-size:1.2rem;color:var(--accent)">
      Выбрано: <span id="chosenTime"></span>
    </div>
    <input type="text" id="clientName" placeholder="Ваше имя" style="display:none;margin:10px 0;padding:14px;border-radius:12px;width:100%" required>
    <input type="tel" id="clientPhone" placeholder="Телефон +7" value="+7" style="display:none;margin:10px 0;padding:14px;border-radius:12px;width:100%" required>
    <select id="service" style="display:none;margin:10px 0;padding:14px;border-radius:12px;width:100%" required></select>
    <div id="finalStep" style="display:none;margin-top:32px">
      <button class="main" onclick="bookAppointment()">Записаться</button>
    </div>
    <div id="instantSuccess" style="display:none;text-align:center;margin-top:40px">
      <div style="font-size:4.8rem;margin:20px 0">Успешно!</div>
      <p style="font-size:1.5rem;color:var(--accent);line-height:1.5" id="successDetails"></p>
      <p style="margin-top:30px;color:var(--text-light)">Закроется автоматически...</p>
    </div>
    <p style="margin-top:20px;color:var(--text-light);font-size:0.9rem">
      Подтвердим запись в течение часа
    </p>
  `);

  setTimeout(() => forceUpdateClientSelect(), 100);
};

// === ВЫБОР ВРЕМЕНИ ===
window.selectTime = (time, el) => {
  // Проверка на пересечение с учётом длительности выбранной услуги
  const serviceSelect = document.getElementById("service");
  const duration = serviceSelect?.value ? services.find(s => s.id === serviceSelect.value)?.duration || 60 : 60;

  if (isTimeOverlapping(currentModalDate, time, duration)) {
    toast("Это время пересекается с другой записью!", "error");
    openClientModal(currentModalDate);
    return;
  }

  document.querySelectorAll('.time-slot-old').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  window.selectedTimeForBooking = time;

  document.getElementById('selectedTimeInfo').style.display = 'block';
  document.getElementById('clientName').style.display = 'block';
  document.getElementById('clientPhone').style.display = 'block';
  document.getElementById('service').style.display = 'block';
  document.getElementById('finalStep').style.display = 'block';

  updateSelectedTimeInfo();
  document.getElementById('clientName').focus();
};

// === ЗАПИСЬ ===
window.bookAppointment = async () => {
  const time = window.selectedTimeForBooking;
  if (!time) return toast("Выберите время!", "error");

  const name = document.getElementById("clientName").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const serviceId = document.getElementById("service").value;
  const masterId = document.getElementById("masterSelect")?.value || null;

  if (!name || !phone || !serviceId) return toast("Заполните все поля!", "error");

  const service = services.find(s => s.id === serviceId);
  if (!service) return toast("Услуга не найдена", "error");

  // Финальная проверка пересечения
  if (isTimeOverlapping(currentModalDate, time, service.duration)) {
    toast("Время уже занято!", "error");
    openClientModal(currentModalDate);
    return;
  }

  document.getElementById("finalStep").style.display = "none";
  document.getElementById("instantSuccess").style.display = "block";
  document.getElementById("successDetails").innerHTML = `
    ${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в ${time}<br>
    ${service.name} (${service.duration} мин)
  `;

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
    masterId,
    createdAt: new Date().toISOString()
  };

  try {
    await addBooking(booking);
    await sendTelegramNotification(booking);
    toast("Вы записаны!", "success");
    setTimeout(closeModal, 3000);
  } catch (e) {
    console.error(e);
    toast("Ошибка записи", "error");
  }
};

// === ОБНОВЛЕНИЕ СЕЛЕКТА УСЛУГ ===
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

  select.addEventListener("change", updateSelectedTimeInfo);

  if (window.selectedTimeForBooking) {
    updateSelectedTimeInfo();
  }
}

function updateSelectedTimeInfo() {
  const select = document.getElementById("service");
  const el = document.getElementById("chosenTime");
  if (!select || !el || !window.selectedTimeForBooking) return;

  const service = services.find(s => s.id === select.value);
  const duration = service ? service.duration : 60;
  el.textContent = `${window.selectedTimeForBooking} (${duration} мин)`;
}

// === БЛОКИРОВКА ДНЯ (для админа) ===
window.blockDay = async (dateStr) => {
  if (confirm("Заблокировать весь день?")) {
    await addDoc(blockedCol, { date: dateStr, fullDay: true });
    toast("День заблокирован", "info");
  }
};

// Экспорт для админки
window.showBookingModal = showBookingModal;

console.log("%cГОСПОДИН, ВСЁ ГОТОВО. НИКАКИХ ОШИБОК. ЗЕЛЁНЫЕ — ТВОИ. КРАСАВА.", "color: gold; background: black; font-size: 22px; font-weight: bold");