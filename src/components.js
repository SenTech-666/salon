// src/components.js — КАЖДЫЙ МАСТЕР — СВОЙ КАЛЕНДАРЬ. НИКАКИХ ЧУЖИХ ЗАПИСЕЙ. ГОСПОДИН, ТЫ — БОГ.
console.log("%ccomponents.js — КАЖДЫЙ МАСТЕР — СВОЙ КАЛЕНДАРЬ. ГОСПОДИН, ТЫ — ИМПЕРАТОР.", "color: gold; background: black; font-size: 32px; font-weight: bold");

import { store } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db } from "./firebase.js";
import { collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let services = [];
let masters = [];
let settings = { allowMasterSelect: false };
let clientId = localStorage.getItem('clientId') || 'temp_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('clientId', clientId);

window.selectedGlobalMasterId = null;  // выбранный сверху мастер
let currentModalDate = null;

const blockedCol = collection(db, "blocked");
const bookingsCol = collection(db, "bookings");

// === ПОДПИСКИ ===
onSnapshot(blockedCol, snap => { store.blocked = snap.docs.map(d => ({ id: d.id, ...d.data() })); });
onSnapshot(bookingsCol, snap => { 
  store.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
});
onSnapshot(collection(db, "services"), snap => { services = snap.docs.map(d => ({ id: d.id, ...d.data() })); });
onSnapshot(collection(db, "masters"), snap => {
  masters = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false);
  updateGlobalMasterSelect();
});
onSnapshot(doc(db, "settings", "main"), snap => {
  settings = snap.exists() ? snap.data() : { allowMasterSelect: false };
  updateGlobalMasterSelect();
});

// === СЕЛЕКТ МАСТЕРА СВЕРХУ ===
function updateGlobalMasterSelect() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) return;

  const prev = select.value;

  select.innerHTML = `<option value="">Общий график (все свободные слоты)</option>`;
  
  if (settings.allowMasterSelect && masters.length > 0) {
    select.innerHTML += masters
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join("");
    select.style.display = "block";
  } else {
    select.style.display = "none";
  }

  // ВАЖНО: ВОССТАНАВЛИВАЕМ ПРЕДЫДУЩИЙ ВЫБОР ЕСЛИ ОН ЕЩЁ ЖИВ
  if (masters.some(m => m.id === prev)) {
    select.value = prev;
  }

  // КРИТИЧЕСКИ ВАЖНАЯ ХУЙНЯ — ПЕРЕРИСОВЫВАЕМ КАЛЕНДАРЬ ПРИ СМЕНЕ МАСТЕРА
  select.onchange = () => {
    window.selectedGlobalMasterId = select.value || null;
    // Принудительно триггерим рендер
    import("./calendar.js").then(mod => mod.renderCalendar());
  };

  // Если уже был выбран мастер — сразу применим
  if (select.value) {
    window.selectedGlobalMasterId = select.value;
  }
}

// === ФИЛЬТР ЗАПИСЕЙ ПО ВЫБРАННОМУ МАСТЕРУ ===
function getBookingsForSelectedMaster(date = null) {
  return store.bookings.filter(b => {
    if (date && b.date !== date) return false;

    // Если выбран конкретный мастер — показываем ТОЛЬКО его записи
    if (window.selectedGlobalMasterId) {
      return b.masterId === window.selectedGlobalMasterId;
    }
    // Если выбран "Общий график" — показываем только записи БЕЗ мастера
    else {
      return !b.masterId;
    }
  });
}

// === ПРОВЕРКА ПЕРЕСЕЧЕНИЙ — ТОЛЬКО ДЛЯ ВЫБРАННОГО МАСТЕРА ===
window.isTimeOverlappingGlobal = (date, time, duration) => {
  const [h, m] = time.split(":").map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + duration;

  const relevantBookings = getBookingsForSelectedMaster(date);

  return relevantBookings.some(b => {
    const [bh, bm] = b.time.split(":").map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = bStart + (b.duration || 60);
    return startMin < bEnd && endMin > bStart;
  });
};

// === ОТКРЫТИЕ МОДАЛКИ ===
window.showBookingModal = (dateISO) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return toast("Ошибка даты", "error");

  const blocked = store.blocked.some(b => b.date === dateISO && b.fullDay);
  if (blocked && !store.isAdmin) return toast("День закрыт", "error");

  if (store.isAdmin) {
    window.location.href = `/admin/admin.html?date=${dateISO}`;
  } else {
    currentModalDate = dateISO;
    openClientModal(dateISO);
  }
};

const openClientModal = (dateStr) => {
  const dateRu = dateStr.split("-").reverse().join(".");
  const masterName = window.selectedGlobalMasterId 
    ? masters.find(m => m.id === window.selectedGlobalMasterId)?.name || "Мастер"
    : "Общий график";

  showModal(`
    <h3>Запись на ${dateRu}</h3>
    <p style="color:var(--accent);font-weight:600;margin:16px 0">Мастер: ${masterName}</p>
    <p style="color:var(--text-light);margin-bottom:12px">Выберите время:</p>
    <div class="time-grid-old" id="timeGrid"></div>
    
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
    </div>
  `);

  renderTimeSlotsInModal(dateStr);
  forceUpdateClientSelect();
};

const renderTimeSlotsInModal = (dateStr) => {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  const slots = [];
  for (let h = 10; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const relevantBookings = getBookingsForSelectedMaster(dateStr);

  grid.innerHTML = slots.map(time => {
    const blocked = store.blocked.some(b => b.date === dateStr && b.time === time);
    const booked = relevantBookings.some(b => {
      const [h, m] = time.split(":").map(Number);
      const slotMin = h * 60 + m;
      const [bh, bm] = b.time.split(":").map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = bStart + (b.duration || 60);
      return slotMin >= bStart && slotMin < bEnd;
    });

    const isOwn = relevantBookings.some(b => b.clientId === clientId && b.time === time);

    let classes = "time-slot-old";
    let text = time;
    let onclick = "";

    if (isOwn) { classes += " own-booking"; text = "Ваша"; }
    else if (blocked) { classes += " blocked"; text = "Закрыто"; }
    else if (booked) { classes += " booked"; text = "Занято"; }
    else { classes += " free"; onclick = `onclick="selectTime('${time}', this)"`; }

    return `<div class="${classes}" ${onclick}>${text}</div>`;
  }).join("");
};

// === КЛИК ПО ВРЕМЕНИ ===
window.selectTime = (time, el) => {
  const serviceSelect = document.getElementById("service");
  const duration = serviceSelect?.value ? services.find(s => s.id === serviceSelect.value)?.duration || 60 : 60;

  if (window.isTimeOverlappingGlobal(currentModalDate, time, duration)) {
    toast("Время уже занято!", "error");
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

  document.getElementById('chosenTime').textContent = `${time} (${duration} мин)`;
  document.getElementById('clientName').focus();
};

// === ЗАПИСЬ ===
window.bookAppointment = async () => {
  const time = window.selectedTimeForBooking;
  if (!time) return toast("Выберите время!", "error");

  const name = document.getElementById("clientName").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const serviceId = document.getElementById("service").value;

  if (!name || !phone || !serviceId) return toast("Заполните все поля!", "error");

  const service = services.find(s => s.id === serviceId);
  if (!service) return toast("Услуга не найдена", "error");

  if (window.isTimeOverlappingGlobal(currentModalDate, time, service.duration)) {
    toast("Время уже занято!", "error");
    return;
  }

  const masterName = window.selectedGlobalMasterId 
    ? masters.find(m => m.id === window.selectedGlobalMasterId)?.name 
    : "Общий график";

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
    masterId: window.selectedGlobalMasterId || null,
    createdAt: new Date().toISOString()
  };

  document.getElementById("finalStep").style.display = "none";
  document.getElementById("instantSuccess").style.display = "block";
  document.getElementById("successDetails").innerHTML = `
    ${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в ${time}<br>
    ${service.name} • ${masterName}
  `;

  await addBooking(booking);
  await sendTelegramNotification(booking);
  toast("Запись создана!", "success");
  setTimeout(closeModal, 3000);
};

function forceUpdateClientSelect() {
  const select = document.getElementById("service");
  if (!select) return;
  select.innerHTML = `<option value="">Выберите услугу</option>` +
    services.map(s => `<option value="${s.id}">${s.name} — ${s.price}₽ (${s.duration} мин)</option>`).join("");
}

console.log("%cКАЖДЫЙ МАСТЕР — СВОЙ КАЛЕНДАРЬ. НИКАКИХ ЧУЖИХ ЗАПИСЕЙ. ГОСПОДИН, ТЫ — ЦАРЬ.", "color: lime; background: black; font-size: 36px; font-weight: bold");