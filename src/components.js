// src/components.js — ФИНАЛЬНАЯ ВЕРСИЯ 16.01.2026 — СЕЛЕКТ МАСТЕРОВ + СОХРАНЕНИЕ В localStorage + ПРИНУДИТЕЛЬНАЯ ПЕРЕРИСОВКА
console.log("%ccomponents.js — ЗАГРУЖЕН 16.01.2026 — СОХРАНЕНИЕ МАСТЕРА + ОБНОВЛЕНИЕ КАЛЕНДАРЯ", "color: gold; background: black; font-size: 42px");

import { store, subscribe } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db, auth } from "./firebase.js";
import { doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

let clientId = localStorage.getItem('clientId') || null;
window.selectedGlobalMasterId = localStorage.getItem('selectedMasterId') || null;
let currentModalDate = null;
let currentOwnBookingId = null;

// Обновляем clientId при анонимной авторизации
onAuthStateChanged(auth, (user) => {
  if (user && user.isAnonymous) {
    clientId = user.uid;
    localStorage.setItem('clientId', user.uid);
  }
});

// Автозаполнение полей по предыдущей записи
const loadLastBookingData = () => {
  const cached = JSON.parse(localStorage.getItem(`lastBookingData_${clientId}`));
  if (cached && Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
    return cached;
  }

  const myBookings = store.bookings
    .filter(b => b.clientId === clientId)
    .sort((a, b) => new Date(b.date + "T" + b.time) - new Date(a.date + "T" + a.time));

  if (myBookings.length === 0) return null;

  const last = myBookings[0];
  return {
    name: last.clientName || "",
    phone: last.clientPhone || "",
    serviceId: last.serviceId || "",
    timestamp: Date.now()
  };
};

const saveLastBookingData = (name, phone, serviceId) => {
  if (!clientId) return;
  const data = {
    name: name.trim(),
    phone: phone.trim(),
    serviceId,
    timestamp: Date.now()
  };
  localStorage.setItem(`lastBookingData_${clientId}`, JSON.stringify(data));
};

// === СЕЛЕКТ МАСТЕРА ===
function updateGlobalMasterSelect() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) {
    console.warn("Селект #globalMasterSelect не найден, сука. Где он, блядь?");
    return;
  }

  const allowSelect = store.settings?.allowMasterSelect ?? true;
  const hasMasters = store.masters?.length > 0;

  // Если выбор мастеров отключён или мастеров вообще нет — прячем всё нахуй
  // Если выбор мастеров отключён или мастеров вообще нет — прячем всю хуйню нахуй
// Прячем весь блок ТОЛЬКО если мастеров реально нет (store.masters.length === 0)
const hasActiveMasters = store.masters?.length > 0;

const container = document.getElementById("master-select-container");
if (!container) {
  console.warn("Контейнер #master-select-container не найден, но похуй продолжаем");
}

if (!hasActiveMasters) {
  // Нет ни одного активного мастера — всё нахуй скрываем
  if (container) container.style.display = "none";
  select.style.display = "none"; // на всякий случай

  window.selectedGlobalMasterId = null;
  localStorage.removeItem('selectedMasterId');

  console.log("%c[MASTER SELECT] Мастеров вообще нет → весь блок спрятан нахуй, как твой бывший в чёрном списке", 
              "color: #ff4444; font-weight: bold; background: #000; padding: 4px 8px;");

  // Рендерим календарь сразу в общем режиме
  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  }
  
  return; // дальше не ебёмся
}

// Если мастера есть — показываем контейнер независимо от allowMasterSelect
if (container) container.style.display = "block";

// Дальше обычная логика: если allowMasterSelect = false — делаем селект минимальным
if (!allowSelect) {
  select.innerHTML = '<option value="">Общий график (единственный вариант)</option>';
  select.value = "";
  window.selectedGlobalMasterId = null;
  localStorage.removeItem('selectedMasterId');
  
  console.log("%c[MASTER SELECT] Выбор отключён в настройках → только общий график, мастеров не выбираем", 
              "color: #ffcc00; font-weight: bold; background: #000; padding: 4px 8px;");
} else {
  // Полный селект с мастерами
  const sortedMasters = [...store.masters].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  let html = `<option value="">Общий график (все мастера)</option>`;
  html += sortedMasters.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
  select.innerHTML = html;

  // Восстанавливаем сохранённый выбор
  const saved = localStorage.getItem('selectedMasterId');
  if (saved && store.masters.some(m => m.id === saved)) {
    select.value = saved;
    window.selectedGlobalMasterId = saved;
  } else {
    select.value = "";
    window.selectedGlobalMasterId = null;
  }

  localStorage.setItem('selectedMasterId', window.selectedGlobalMasterId || "");
}

console.log(`%c[MASTER SELECT] → выбран: ${window.selectedGlobalMasterId || 'Общий'} → рендерим`, 
            "color: #00ff9d; font-weight: bold; background: #000; padding: 4px 8px;");

// Финальный рендер календаря
if (typeof window.renderCalendar === 'function') {
  window.renderCalendar();
}

  // Если дошли сюда — мастера есть и выбор включён → показываем селект
  select.style.display = "block";

  // Сортируем мастеров по имени (русский порядок, чтоб не было пиздеца с "Я" после "А")
  const sortedMasters = [...store.masters].sort((a, b) => 
    a.name.localeCompare(b.name, 'ru')
  );

  let html = `<option value="">Общий график (все мастера)</option>`;
  html += sortedMasters.map(m => 
    `<option value="${m.id}">${m.name}</option>`
  ).join("");

  select.innerHTML = html;

  // Пытаемся восстановить предыдущий выбор
  const saved = localStorage.getItem('selectedMasterId');
  let newSelected = null;

  if (saved && store.masters.some(m => m.id === saved)) {
    newSelected = saved;
  } else {
    // Если сохранённого нет или он больше не существует — сбрасываем в общий
    newSelected = null;
  }

  select.value = newSelected || "";
  window.selectedGlobalMasterId = newSelected;

  // Сохраняем актуальный выбор (даже если null — чистим localStorage)
  localStorage.setItem('selectedMasterId', newSelected || "");

  console.log(`%c[MASTER SELECT] → выбран мастер: ${newSelected || 'Общий график'} → обновляем календарь`, 
              'color: #00ff9d; font-weight: bold; background: #000; padding: 4px 8px;');

  // Принудительный рендер календаря — без этого иногда календарь тупит
  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  } else {
    console.error("renderCalendar не найден в window, пиздец какой-то");
  }
}

window.updateGlobalMasterSelect = updateGlobalMasterSelect;

// Обработчик изменения селекта
function attachMasterSelectListener() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) return;

  // Удаляем старый обработчик, если был (избегаем дублирования)
  select.removeEventListener("change", handleMasterChange);
  select.addEventListener("change", handleMasterChange);
}

function handleMasterChange(e) {
  const newMasterId = e.target.value || null;
  window.selectedGlobalMasterId = newMasterId;
  localStorage.setItem('selectedMasterId', newMasterId || "");

  console.log(`%cСмена мастера в селекте → ${newMasterId || 'Общий график'} | Перерисовка календаря`, 'color:#ffcc00; font-weight:bold; background:#000; padding:4px 8px;');

  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  } else {
    console.error("renderCalendar не найден при смене мастера");
  }
}

// Подписка на store — обновляем селект и вешаем слушатель
subscribe(() => {
  setTimeout(() => {
    const select = document.getElementById("globalMasterSelect");
    if (select) {
      window.updateGlobalMasterSelect();
      attachMasterSelectListener();
    }
  }, 80);
});

// Первичная инициализация
setTimeout(() => {
  const select = document.getElementById("globalMasterSelect");
  if (select) {
    window.updateGlobalMasterSelect();
    attachMasterSelectListener();

    // Дополнительный принудительный рендер после полной загрузки
    if (typeof window.renderCalendar === 'function') {
      window.renderCalendar();
    }
  }
}, 600);

// === ОТКРЫТИЕ МОДАЛКИ ===
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
    b.date === dateISO && 
    b.clientId === clientId && 
    new Date(b.date + "T" + b.time) > new Date()
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
  const masterName = booking.masterId 
    ? store.masters.find(m => m.id === booking.masterId)?.name || "—" 
    : "Общий график";

  const service = store.services.find(s => s.id === booking.serviceId) || { name: "—" };

  const hoursUntil = (new Date(booking.date + "T" + booking.time) - new Date()) / (1000 * 60 * 60);
  const canManage = hoursUntil > 24;

  showModal(`
    <div style="padding:32px 24px;max-width:480px;background:var(--card);border-radius:32px;box-shadow:var(--shadow-hover);text-align:center;">
      <h3 style="font-size:2.4rem;color:var(--accent);font-family:'Playfair Display',serif;">У вас уже есть запись</h3>
      <div style="background:#f9f5f3;padding:24px;border-radius:20px;margin:24px 0;">
        <p><strong>Дата:</strong> ${new Date(booking.date).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})}</p>
        <p><strong>Время:</strong> ${booking.time}</p>
        <p><strong>Услуга:</strong> ${service.name}</p>
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
    if (!booking) throw new Error("Запись не найдена");
    
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
  if (!oldBooking) return false;

  const newTime = window.selectedTimeForBooking;
  const serviceId = document.getElementById("service")?.value;
  const service = store.services.find(s => s.id === serviceId);

  if (!service || !newTime || (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, newTime, service.duration))) {
    toast("Время занято или услуга не выбрана!", "error");
    return false;
  }

  try {
    await updateDoc(doc(db, "bookings", currentOwnBookingId), {
      time: newTime,
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      price: service.price || 0
    });

    await sendTelegramNotification({ ...oldBooking, newTime, action: "ПЕРЕНОС КЛИЕНТОМ" });

    store.bookings = store.bookings.map(b => 
      b.id === currentOwnBookingId 
        ? { ...b, time: newTime, serviceId: service.id, serviceName: service.name, duration: service.duration, price: service.price || 0 }
        : b
    );

    toast("Запись перенесена!", "success");
    currentOwnBookingId = null;
    return true;
  } catch (err) {
    toast("Ошибка переноса", "error");
    console.error(err);
    return false;
  }
};

// === СОЗДАНИЕ / ПЕРЕНОС ЗАПИСИ ===
window.bookAppointment = async () => {
  if (currentOwnBookingId) {
    const ok = await window.transferBookingIfNeeded();
    if (ok) {
      document.getElementById("finalStep")?.style?.setProperty("display", "none");
      document.getElementById("instantSuccess")?.style?.setProperty("display", "block");
      document.getElementById("successDetails").innerHTML = `Перенесено!<br>${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в <strong>${window.selectedTimeForBooking}</strong>`;
      setTimeout(closeModal, 4000);
    }
    return;
  }

  const time = window.selectedTimeForBooking;
  const nameInput = document.getElementById("clientName");
  const phoneInput = document.getElementById("clientPhone");
  const serviceSelect = document.getElementById("service");

  if (!time || !nameInput?.value?.trim() || !phoneInput?.value?.trim() || !serviceSelect?.value) {
    return toast("Заполните все поля", "error");
  }

  const service = store.services.find(s => s.id === serviceSelect.value);
  if (!service) return toast("Услуга не найдена", "error");

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, time, service.duration)) {
    return toast("Время уже занято!", "error");
  }

  const bookingData = {
    date: currentModalDate,
    time,
    clientName: nameInput.value.trim(),
    clientPhone: phoneInput.value.trim(),
    clientId,
    serviceId: service.id,
    serviceName: service.name,
    duration: service.duration,
    price: service.price || 0,
    masterId: window.selectedGlobalMasterId || null,
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addBooking(bookingData);
    const newBooking = { id: docRef.id, ...bookingData };
    await sendTelegramNotification(newBooking);
    saveLastBookingData(nameInput.value.trim(), phoneInput.value.trim(), service.id);

    document.getElementById("finalStep")?.style?.setProperty("display", "none");
    document.getElementById("instantSuccess")?.style?.setProperty("display", "block");
    document.getElementById("successDetails").innerHTML = `${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в <strong>${time}</strong><br>${service.name}`;
    toast("Запись создана!", "success");
    setTimeout(closeModal, 4000);

    setTimeout(() => {
      if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
      }
    }, 300);
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

  const lastData = loadLastBookingData();

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

      <input type="text" id="clientName" placeholder="Ваше имя" value="${lastData?.name || ''}" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required>
      <input type="tel" id="clientPhone" placeholder="+7 (___) ___-__-__" value="${lastData?.phone || ''}" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required>
      <select id="service" style="display:none;width:100%;padding:18px;margin:10px 0;border-radius:20px;border:2px solid #eee;font-size:1.1rem;" required>
        <option value="">Выберите услугу</option>
        ${store.services.map(s => `<option value="${s.id}" ${lastData?.serviceId === s.id ? 'selected' : ''}>${s.name} — ${s.price}₽ (${s.duration} мин)</option>`).join("")}
      </select>

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

  requestAnimationFrame(() => {
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    if (nameInput && !nameInput.value.trim()) {
      nameInput.focus();
    } else if (phoneInput && !phoneInput.value.trim()) {
      phoneInput.focus();
    } else {
      document.getElementById('service')?.focus();
    }
  });
};

// === РЕНДЕР СЛОТОВ В МОДАЛКЕ ===
const renderTimeSlotsInModal = (dateStr) => {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  const slots = [];
  for (let h = 10; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const relevantBookings = window.getRelevantBookings?.(dateStr) || [];

  grid.innerHTML = slots.map(time => {
    const blocked = store.blocked.some(b => b.date === dateStr && b.time === time);
    const booked = relevantBookings.some(b => {
      const slotMin = timeToMinutes(time);
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration || 60);
      return slotMin >= bStart && slotMin < bEnd;
    });

    let classes = "time-slot-old";
    let text = time;
    let onclick = "";

    if (relevantBookings.some(b => b.clientId === clientId)) {
      classes += " own-booking";
      text = "Ваша запись";
    } else if (blocked) {
      classes += " blocked";
      text = "Закрыто";
    } else if (booked) {
      classes += " booked";
      text = "Занято";
    } else {
      classes += " free";
      onclick = `onclick="selectTime('${time}', this)"`;
    }

    return `<div class="${classes}" ${onclick}>${text}</div>`;
  }).join("");
};

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

window.selectTime = (time, el) => {
  const serviceSelect = document.getElementById("service");
  let duration = 60;
  if (serviceSelect?.value) {
    const service = store.services.find(s => s.id === serviceSelect.value);
    duration = service?.duration || 60;
  }

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, time, duration)) {
    toast("Это время уже занято!", "error");
    return;
  }

  document.querySelectorAll('.time-slot-old').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  window.selectedTimeForBooking = time;

  const selectedInfo = document.getElementById('selectedTimeInfo');
  const nameInput = document.getElementById('clientName');
  const phoneInput = document.getElementById('clientPhone');
  const serviceEl = document.getElementById('service');
  const finalStep = document.getElementById('finalStep');

  if (selectedInfo) selectedInfo.style.display = 'block';
  if (nameInput) nameInput.style.display = 'block';
  if (phoneInput) phoneInput.style.display = 'block';
  if (serviceEl) serviceEl.style.display = 'block';
  if (finalStep) finalStep.style.display = 'block';

  const chosenTimeEl = document.getElementById('chosenTime');
  if (chosenTimeEl) chosenTimeEl.textContent = `${time} (${duration} мин)`;

  nameInput?.focus();
};

// === forceUpdateClientSelect ===
function forceUpdateClientSelect() {
  const select = document.getElementById("service");
  if (!select) return;

  select.innerHTML = `<option value="">Выберите услугу</option>` +
    store.services.map(s => `<option value="${s.id}">${s.name} — ${s.price}₽ (${s.duration} мин)</option>`).join("");
}

export { updateGlobalMasterSelect };

console.log("%cCOMPONENTS.JS — ГОТОВ. Выбор мастера сохраняется. Календарь обновляется при смене.", "color: lime; background: black; font-size: 48px; font-weight: bold");