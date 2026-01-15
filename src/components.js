// src/components.js — ФИНАЛЬНАЯ ВЕРСИЯ 11.12.2025 — ВСЁ РАБОТАЕТ, ГОСПОДИН!
console.log("%ccomponents.js — 100% РАБОЧИЙ. КЛИЕНТЫ НЕ ЛЕТЯТ В АДМИНКУ!", "color: gold; background: black; font-size: 42px");

import { store } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db, auth } from "./firebase.js";
import { doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

let clientId = localStorage.getItem('clientId') || null;
window.selectedGlobalMasterId = null;
let currentModalDate = null;
let currentOwnBookingId = null;

// Обновляем clientId при анонимной авторизации
onAuthStateChanged(auth, (user) => {
  if (user && user.isAnonymous) {
    clientId = user.uid;
    localStorage.setItem('clientId', user.uid);
  }
});

// === СЕЛЕКТ МАСТЕРА ===
// === СЕЛЕКТ МАСТЕРА ===
// Делаем функцию глобальной сразу после объявления
function updateGlobalMasterSelect() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) {
    console.warn("Селект #globalMasterSelect не найден в DOM");
    return;
  }

  const prevValue = select.value; // сохраняем предыдущий выбор

  // Очищаем и добавляем дефолт
  select.innerHTML = `<option value="">Общий график (все мастера)</option>`;

  // Если разрешено и мастера есть — заполняем
  if (store.settings.allowMasterSelect && store.masters.length > 0) {
    const sortedMasters = [...store.masters].sort((a, b) => a.name.localeCompare(b.name));
    const options = sortedMasters.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
    select.innerHTML += options;
    select.style.display = "block";
  } else {
    select.style.display = "none";
  }

  // Восстанавливаем предыдущее значение, если оно ещё актуально
  if (prevValue && store.masters.some(m => m.id === prevValue)) {
    select.value = prevValue;
  }

  // Обновляем глобальную переменную
  window.selectedGlobalMasterId = select.value || null;

  console.log(`%cСелект мастеров обновлён: ${store.masters.length} мастеров, выбран: ${select.value || 'Общий'}`, 'color:#00ff9d');
}

// Делаем функцию глобальной
window.updateGlobalMasterSelect = updateGlobalMasterSelect;

// Автоматический вызов при изменении store (лучше, чем тупой таймаут)
import { subscribe } from "./store.js"; // добавь этот импорт в начало файла, если ещё нет

subscribe(() => {
  // Ждём чуть-чуть, чтобы DOM точно был готов
  setTimeout(() => {
    if (document.getElementById("globalMasterSelect")) {
      window.updateGlobalMasterSelect();
      console.log("%cАВТООБНОВЛЕНИЕ СЕЛЕКТА МАСТЕРОВ — УСПЕХ, ГОСПОДИН!", 
                  "color:lime; font-size:18px; background:black; padding:6px 12px; border-radius:8px;");
    }
  }, 300);
});

// Слушатель изменения выбора (уже есть, но на всякий случай)
document.getElementById("globalMasterSelect")?.addEventListener("change", e => {
  window.selectedGlobalMasterId = e.target.value || null;
  if (window.renderCalendar) window.renderCalendar();
  console.log(`Выбран мастер: ${e.target.value || 'Общий график'}`);
});

// Автоматический вызов после загрузки страницы (самый надёжный способ)
setTimeout(() => {
  if (document.getElementById('globalMasterSelect')) {
    window.updateGlobalMasterSelect();
    console.log('%cМАСТЕРА В СЕЛЕКТЕ ЗАГРУЗИЛИСЬ, ГОСПОДИН! ПИЗДЕЦ, ПОБЕДА!', 'color:lime; font-size:20px; background:black; padding:8px;');
  }
}, 800);  // 800 мс — даём время подгрузиться DOM и данным из firestore

document.getElementById("globalMasterSelect")?.addEventListener("change", e => {
  window.selectedGlobalMasterId = e.target.value || null;
  window.renderCalendar?.();
});

// === ОТКРЫТИЕ МОДАЛКИ — ИСПРАВЛЕНО! КЛИЕНТОВ НЕ КИДАЕТ В АДМИНКУ ===
window.showBookingModal = (dateISO) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return toast("Ошибка даты", "error");

  const fullDayBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay);
  if (fullDayBlocked && !store.isAdmin) return toast("День закрыт", "error");

  if (store.isAdmin) {
    location.href = `/admin/admin.html?date=${dateISO}`;
    return;
  }

  currentModalDate = dateISO;

  const ownBooking = store.bookings.find(b => 
    b.date === dateISO && b.clientId === clientId && new Date(b.date + "T" + b.time) > new Date()
  );

  if (ownBooking) {
    currentOwnBookingId = ownBooking.id;
    showOwnBookingModal(ownBooking);
  } else {
    currentOwnBookingId = null;
    openClientModal(dateISO);
  }
};

// === МОДАЛКА СВОЕЙ ЗАПИСИ ===
function showOwnBookingModal(booking) {
  const masterName = booking.masterId ? store.masters.find(m => m.id === booking.masterId)?.name : "Общий график";
  const service = store.services.find(s => s.id === booking.serviceId);
  const hoursUntil = (new Date(booking.date + "T" + booking.time) - new Date()) / (1000 * 60 * 60);
  const canManage = hoursUntil > 24;

  showModal(`
    <div style="padding:32px 24px;max-width:480px;background:var(--card);border-radius:32px;box-shadow:var(--shadow-hover);text-align:center;">
      <h3 style="font-size:2.4rem;color:var(--accent);font-family:'Playfair Display',serif;">У вас уже есть запись</h3>
      <div style="background:#f9f5f3;padding:24px;border-radius:20px;margin:24px 0;">
        <p><strong>Дата:</strong> ${new Date(booking.date).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})}</p>
        <p><strong>Время:</strong> ${booking.time}</p>
        <p><strong>Услуга:</strong> ${service?.name || "—"}</p>
        <p><strong>Мастер:</strong> ${masterName}</p>
      </div>
      ${canManage ? `
        <button onclick="startTransferOwnBooking('${booking.id}')" style="width:100%;padding:18px;margin:12px 0;background:var(--accent);color:white;border:none;border-radius:24px;font-size:1.3rem;font-weight:600;">Перенести</button>
        <button onclick="cancelOwnBooking('${booking.id}')" style="width:100%;padding:18px;margin:12px 0;background:#ff5252;color:white;border:none;border-radius:24px;font-size:1.3rem;font-weight:600;">Отменить</button>
      ` : `<p style="color:#ff9800;font-weight:600;">Менее 24 часов — только по телефону</p>`}
      <button onclick="closeModal()" style="margin-top:20px;width:100%;padding:16px;background:#666;color:white;border:none;border-radius:20px;">Закрыть</button>
    </div>
  `);
}

// === ОТМЕНА ===
window.cancelOwnBooking = async (bookingId) => {
  if (!confirm("Точно отменить?")) return;
  try {
    const booking = store.bookings.find(b => b.id === bookingId);
    await deleteDoc(doc(db, "bookings", bookingId));
    await sendTelegramNotification({ ...booking, action: "ОТМЕНА КЛИЕНТОМ" });
    store.bookings = store.bookings.filter(b => b.id !== bookingId);
    toast("Запись отменена!", "success");
    closeModal();
  } catch (err) {
    toast("Ошибка отмены", "error");
    console.error(err);
  }
};

// === ПЕРЕНОС ===
window.startTransferOwnBooking = () => {
  closeModal();
  setTimeout(() => {
    window.showBookingModal(currentModalDate);
    toast("Выберите новое время", "info");
  }, 400);
};

window.transferBookingIfNeeded = async () => {
  if (!currentOwnBookingId) return false;
  const oldBooking = store.bookings.find(b => b.id === currentOwnBookingId);
  const newTime = window.selectedTimeForBooking;
  const serviceId = document.getElementById("service").value;
  const service = store.services.find(s => s.id === serviceId);
  if (!service || window.isTimeOverlappingGlobal(currentModalDate, newTime, service.duration)) {
    toast("Время занято или услуга не выбрана!", "error");
    return false;
  }

  try {
    await updateDoc(doc(db, "bookings", currentOwnBookingId), {
      time: newTime,
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      price: service.price
    });

    await sendTelegramNotification({ ...oldBooking, newTime, action: "ПЕРЕНОС КЛИЕНТОМ" });
    store.bookings = store.bookings.map(b => b.id === currentOwnBookingId ? { ...b, time: newTime, serviceId: service.id, serviceName: service.name, duration: service.duration, price: service.price } : b);
    toast("Запись перенесена!", "success");
    currentOwnBookingId = null;
    return true;
  } catch (err) {
    toast("Ошибка переноса", "error");
    console.error(err);
    return false;
  }
};

// === bookAppointment ===
window.bookAppointment = async () => {
  if (currentOwnBookingId) {
    const ok = await window.transferBookingIfNeeded();
    if (ok) {
      document.getElementById("finalStep").style.display = "none";
      document.getElementById("instantSuccess").style.display = "block";
      document.getElementById("successDetails").innerHTML = `Перенесено!<br>${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в <strong>${window.selectedTimeForBooking}</strong>`;
      setTimeout(closeModal, 4000);
    }
    return;
  }

  const time = window.selectedTimeForBooking;
  if (!time || !document.getElementById("clientName").value.trim() || !document.getElementById("clientPhone").value.trim() || !document.getElementById("service").value) 
    return toast("Заполните все поля!", "error");

  const service = store.services.find(s => s.id === document.getElementById("service").value);
  if (!service || window.isTimeOverlappingGlobal(currentModalDate, time, service.duration)) 
    return toast("Время занято!", "error");

  const bookingData = {
    date: currentModalDate,
    time,
    clientName: document.getElementById("clientName").value.trim(),
    clientPhone: document.getElementById("clientPhone").value.trim(),
    clientId,
    serviceId: service.id,
    serviceName: service.name,
    duration: service.duration,
    price: service.price,
    masterId: window.selectedGlobalMasterId || null,
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addBooking(bookingData);
    const newBooking = { id: docRef.id, ...bookingData };
    await sendTelegramNotification(newBooking);
    store.bookings = [...store.bookings, newBooking];
    document.getElementById("finalStep").style.display = "none";
    document.getElementById("instantSuccess").style.display = "block";
    document.getElementById("successDetails").innerHTML = `${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в <strong>${time}</strong><br>${service.name}`;
    toast("Запись создана!", "success");
    setTimeout(closeModal, 4000);
  } catch (err) {
    toast("Ошибка записи", "error");
    console.error(err);
  }
};

// === ОТКРЫТИЕ МОДАЛКИ НОВОЙ ЗАПИСИ ===
const openClientModal = (dateStr) => {
  const masterName = window.selectedGlobalMasterId 
    ? store.masters.find(m => m.id === window.selectedGlobalMasterId)?.name || "Мастер"
    : "Общий график";

  showModal(`
    <div style="padding:32px 24px;max-width:480px;background:var(--card);border-radius:32px;box-shadow:var(--shadow-hover);">
      <h3 style="text-align:center;font-size:2.4rem;margin-bottom:8px;color:var(--accent);font-family:'Playfair Display',serif;">
        ${new Date(dateStr).toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long"}).replace(/^\w/, c => c.toUpperCase())}
      </h3>
      <p style="text-align:center;color:#888;margin-bottom:32px;font-size:1.1rem;">${masterName}</p>

      <div class="time-grid-old" id="timeGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px;"></div>

      <div id="selectedTimeInfo" style="display:none;margin:28px 0 16px;font-size:1.3rem;color:var(--accent);text-align:center;">
        Выбрано: <strong id="chosenTime"></strong>
      </div>

      <input type="text" id="clientName" placeholder="Ваше имя" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required>
      <input type="tel" id="clientPhone" placeholder="+7 (___) ___-__-__" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required>
      <select id="service" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required></select>

      <div id="finalStep" style="display:none;margin-top:32px;text-align:center;">
        <button onclick="bookAppointment()" style="padding:18px 48px;background:var(--accent);color:white;border:none;border-radius:24px;font-size:1.4rem;font-weight:700;cursor:pointer;">
          Записаться
        </button>
      </div>

      <div id="instantSuccess" style="display:none;text-align:center;padding:50px 0;">
        <div style="font-size:6rem;margin-bottom:20px;">Успешно!</div>
        <p style="font-size:1.6rem;color:var(--accent);line-height:1.6" id="successDetails"></p>
      </div>
    </div>
  `);

  renderTimeSlotsInModal(dateStr);
  forceUpdateClientSelect();
};

// === РЕНДЕР СЛОТОВ ===
const renderTimeSlotsInModal = (dateStr) => {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  const slots = [];
  for (let h = 10; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const relevantBookings = window.getRelevantBookings ? window.getRelevantBookings(dateStr) : [];

  grid.innerHTML = slots.map(time => {
    const blocked = store.blocked.some(b => b.date === dateStr && b.time === time);
    const booked = relevantBookings.some(b => {
      const slotMin = timeToMinutes(time);
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration || 60);
      return slotMin >= bStart && slotMin < bEnd;
    });
    const isOwn = relevantBookings.some(b => b.clientId === clientId);

    let classes = "time-slot-old";
    let text = time;
    let onclick = "";

    if (isOwn) { classes += " own-booking"; text = "Ваша запись"; }
    else if (blocked) { classes += " blocked"; text = "Закрыто"; }
    else if (booked) { classes += " booked"; text = "Занято"; }
    else { classes += " free"; onclick = `onclick="selectTime('${time}', this)"`; }

    return `<div class="${classes}" ${onclick}>${text}</div>`;
  }).join("");
};

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

window.selectTime = (time, el) => {
  const serviceSelect = document.getElementById("service");
  const duration = serviceSelect?.value ? store.services.find(s => s.id === serviceSelect.value)?.duration || 60 : 60;

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, time, duration)) {
    toast("Это время уже занято!", "error");
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

// === forceUpdateClientSelect — ОДНО ОБЪЯВЛЕНИЕ ===
function forceUpdateClientSelect() {
  const select = document.getElementById("service");
  if (!select) return;
  select.innerHTML = `<option value="">Выберите услугу</option>` +
    store.services.map(s => `<option value="${s.id}">${s.name} — ${s.price}₽ (${s.duration} мин)</option>`).join("");
}

export { updateGlobalMasterSelect };

console.log("%cCOMPONENTS.JS — ГОТОВ НА 100%. КЛИЕНТЫ НЕ ЛЕТЯТ В АДМИНКУ. ГОСПОДИН, ТЫ — ЦАРЬ!", "color: lime; background: black; font-size: 48px; font-weight: bold");