// src/components.js
// Модуль пользовательских компонентов интерфейса
// Отвечает за работу селекта мастеров, модальных окон записи, автозаполнения форм, 
// обработки отмены/переноса записей и взаимодействия клиента с календарем

import { store, subscribe } from "./store.js";
import { showModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { addBooking } from "./firebase.js";
import { sendTelegramNotification } from "./telegram.js";
import { db, auth } from "./firebase.js";
import { doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Глобальные переменные для хранения состояния клиента и выбранного мастера
let clientId = localStorage.getItem('clientId') || null;
window.selectedGlobalMasterId = localStorage.getItem('selectedMasterId') || null;
let currentModalDate = null;
let currentOwnBookingId = null;

// NEW: Переменные для режима переноса записи
let isTransferMode = false;
let transferBookingData = null; // { id, clientName, clientPhone, serviceId, serviceName, duration, price, oldDate, oldTime, masterId }


// Обновление идентификатора клиента при успешной анонимной аутентификации
onAuthStateChanged(auth, (user) => {
  if (user && user.isAnonymous) {
    clientId = user.uid;
    localStorage.setItem('clientId', user.uid);
  }
});

/**
 * Загружает данные последней записи клиента для автозаполнения формы
 * Сначала проверяет кэш в localStorage (действителен 30 дней), 
 * затем ищет последнюю реальную запись в store
 * @returns {Object|null} Данные для автозаполнения или null
 */
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

/**
 * Сохраняет данные последней записи клиента в localStorage
 * @param {string} name Имя клиента
 * @param {string} phone Телефон клиента
 * @param {string} serviceId Идентификатор выбранной услуги
 */
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

/**
 * Обновляет глобальный селект выбора мастера
 * Учитывает настройки allowMasterSelect и наличие активных мастеров в базе
 */
function updateGlobalMasterSelect() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) {
    console.warn("Элемент селекта мастеров #globalMasterSelect не найден в DOM");
    return;
  }

  const allowSelect = store.settings?.allowMasterSelect ?? true;
  const hasActiveMasters = store.masters?.length > 0;

  const container = document.getElementById("master-select-container");

  // Если нет ни одного активного мастера — полностью скрываем блок выбора
  if (!hasActiveMasters) {
    if (container) container.style.display = "none";
    
    window.selectedGlobalMasterId = null;
    localStorage.removeItem('selectedMasterId');

    if (typeof window.renderCalendar === 'function') {
      window.renderCalendar();
    }
    return;
  }

  // Показываем контейнер, если хотя бы один мастер существует
  if (container) container.style.display = "block";

  if (!allowSelect) {
    // Выбор мастера отключён в настройках — показываем только общий график
    select.innerHTML = '<option value="">Общий график (единственный вариант)</option>';
    select.value = "";
    window.selectedGlobalMasterId = null;
    localStorage.removeItem('selectedMasterId');
  } else {
    // Формируем полный список мастеров с сортировкой по имени (русский порядок)
    const sortedMasters = [...store.masters].sort((a, b) => 
      a.name.localeCompare(b.name, 'ru')
    );

    let html = `<option value="">Общий график (все мастера)</option>`;
    html += sortedMasters.map(m => 
      `<option value="${m.id}">${m.name}</option>`
    ).join("");

    select.innerHTML = html;

    // Восстанавливаем ранее выбранного мастера, если он всё ещё существует
    const saved = localStorage.getItem('selectedMasterId');
    let newSelected = null;

    if (saved && store.masters.some(m => m.id === saved)) {
      newSelected = saved;
    }

    select.value = newSelected || "";
    window.selectedGlobalMasterId = newSelected;
    localStorage.setItem('selectedMasterId', newSelected || "");
  }

  // Принудительная перерисовка календаря после изменения селекта
  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  }
}

// Делаем функцию доступной глобально
window.updateGlobalMasterSelect = updateGlobalMasterSelect;

// Привязка обработчика события изменения селекта мастера
function attachMasterSelectListener() {
  const select = document.getElementById("globalMasterSelect");
  if (!select) return;

  // Удаляем старый обработчик, чтобы избежать дублирования
  select.removeEventListener("change", handleMasterChange);
  select.addEventListener("change", handleMasterChange);
}

function handleMasterChange(e) {
  const newMasterId = e.target.value || null;
  window.selectedGlobalMasterId = newMasterId;
  localStorage.setItem('selectedMasterId', newMasterId || "");

  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  }
}

// Автоматическое обновление селекта при изменении данных в store
subscribe(() => {
  setTimeout(() => {
    const select = document.getElementById("globalMasterSelect");
    if (select) {
      window.updateGlobalMasterSelect();
      attachMasterSelectListener();
    }
  }, 80);
});

// Первичная инициализация селекта при загрузке страницы
setTimeout(() => {
  const select = document.getElementById("globalMasterSelect");
  if (select) {
    window.updateGlobalMasterSelect();
    attachMasterSelectListener();

    // Дополнительный рендер календаря после полной инициализации
    if (typeof window.renderCalendar === 'function') {
      window.renderCalendar();
    }
  }
}, 600);

/**
 * Открывает модальное окно для создания новой записи или управления существующей
 * @param {string} dateISO Дата в формате YYYY-MM-DD
 */
window.showBookingModal = (dateISO) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    toast("Некорректный формат даты", "error");
    return;
  }

  const fullDayBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay);
  if (fullDayBlocked && !store.isAdmin) {
    toast("Этот день полностью закрыт для записи", "error");
    return;
  }

  // Для администратора — редирект в админ-панель
  if (store.isAdmin) {
    location.href = `/admin/admin.html?date=${dateISO}`;
    return;
  }

  currentModalDate = dateISO;

  // Если это режим переноса — сразу открываем укороченную модалку
  if (isTransferMode) {
    openTransferModal(dateISO);
    return;
  }

  // Проверяем, есть ли у клиента активная запись на эту дату
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

/**
 * Модалка для переноса — только выбор времени
 */
function openTransferModal(dateISO) {
  if (!transferBookingData) {
    toast("Ошибка: данные переноса потерялись, пиздец", "error");
    isTransferMode = false;
    return;
  }

  const service = store.services.find(s => s.id === transferBookingData.serviceId) || { name: "—", duration: 60 };

  showModal(`
    <div style="padding:32px 24px;max-width:480px;background:var(--card);border-radius:32px;box-shadow:var(--shadow-hover);">
      <h3 style="text-align:center;font-size:2.2rem;margin-bottom:16px;color:var(--accent);font-family:'Playfair Display',serif;">
        Перенос записи
      </h3>
      <div style="background:#f9f5f3;padding:20px;border-radius:16px;margin-bottom:24px;text-align:center;">
        <p><strong>Клиент:</strong> ${transferBookingData.clientName}</p>
        <p><strong>Старая дата/время:</strong> ${new Date(transferBookingData.oldDate).toLocaleDateString("ru-RU")} ${transferBookingData.oldTime}</p>
        <p><strong>Услуга:</strong> ${transferBookingData.serviceName} (${transferBookingData.duration} мин)</p>
      </div>
      
      <p style="text-align:center;margin-bottom:20px;font-size:1.2rem;">Выберите новое время</p>
      
      <div class="time-grid-old" id="timeGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px;"></div>

      <div id="selectedTimeInfo" style="display:none;margin:28px 0 16px;font-size:1.3rem;color:var(--accent);text-align:center;">
        Новое время: <strong id="chosenTime"></strong>
      </div>

      <div id="finalStep" style="display:none;margin-top:32px;text-align:center;">
        <button onclick="confirmTransfer()" style="padding:18px 48px;background:var(--accent);color:white;border:none;border-radius:24px;font-size:1.4rem;font-weight:700;cursor:pointer;">
          Перенести
        </button>
      </div>

      <div id="instantSuccess" style="display:none;text-align:center;padding:50px 0;">
        <h3 style="color:var(--accent);font-size:2rem;">Готово!</h3>
        <p style="font-size:1.4rem;margin-top:16px;" id="successDetails"></p>
      </div>
    </div>
  `);

  renderTimeSlotsInModal(dateISO);
}

/**
 * Подтверждение переноса
 */
window.confirmTransfer = async () => {
  if (!transferBookingData || !window.selectedTimeForBooking) {
    toast("Выбери время, долбоёб", "error");
    return;
  }

  const service = store.services.find(s => s.id === transferBookingData.serviceId);
  if (!service) {
    toast("Услуга не найдена, пиздец", "error");
    return;
  }

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, window.selectedTimeForBooking, service.duration)) {
    toast("Это время уже занято, выбирай другое", "error");
    return;
  }

  try {
    await updateDoc(doc(db, "bookings", transferBookingData.id), {
      date: currentModalDate,
      time: window.selectedTimeForBooking,
      // можно добавить updatedAt: new Date().toISOString()
    });

    // Уведомление в телеграм
    await sendTelegramNotification({
      ...transferBookingData,
      date: currentModalDate,
      time: window.selectedTimeForBooking,
      action: "ПЕРЕНОС КЛИЕНТОМ"
    });

    toast.success("Запись перенесена, красавчик!");
    
    document.getElementById("finalStep")?.style?.setProperty("display", "none");
    document.getElementById("instantSuccess")?.style?.setProperty("display", "block");
    document.getElementById("successDetails").innerHTML = 
      `Новая дата: ${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})}<br>время: <strong>${window.selectedTimeForBooking}</strong>`;

    // Сбрасываем режим переноса
    isTransferMode = false;
    transferBookingData = null;

    setTimeout(closeModal, 4000);

    if (typeof window.renderCalendar === 'function') {
      window.renderCalendar();
    }
  } catch (err) {
    toast.error("Не удалось перенести: " + err.message);
    console.error("Ошибка переноса:", err);
  }
};

/**
 * Отображает модальное окно с информацией о существующей записи клиента
 * @param {Object} booking Данные существующей записи
 */
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
        <button onclick="startTransferOwnBooking('${booking.id}')" style="width:100%;padding:18px;margin:12px 0;background:var(--accent);color:white;border:none;border-radius:24px;font-size:1.3rem;font-weight:600;">Перенести запись</button>
        <button onclick="cancelOwnBooking('${booking.id}')" style="width:100%;padding:18px;margin:12px 0;background:#ff5252;color:white;border:none;border-radius:24px;font-size:1.3rem;font-weight:600;">Отменить запись</button>
      ` : `<p style="color:#ff9800;font-weight:600;">До записи менее 24 часов — изменения только по телефону</p>`}
      <button onclick="closeModal()" style="margin-top:20px;width:100%;padding:16px;background:#666;color:white;border:none;border-radius:20px;">Закрыть</button>
    </div>
  `);
}

/**
 * Запускает процесс переноса существующей записи
 * @param {string} bookingId 
 */
window.startTransferOwnBooking = (bookingId) => {
  const booking = store.bookings.find(b => b.id === bookingId);
  if (!booking) {
    toast("Запись не найдена, хуйня какая-то", "error");
    return;
  }

  isTransferMode = true;
  transferBookingData = {
    id: booking.id,
    clientName: booking.clientName,
    clientPhone: booking.clientPhone,
    serviceId: booking.serviceId,
    serviceName: booking.serviceName || "—",
    duration: booking.duration || 60,
    price: booking.price || 0,
    oldDate: booking.date,
    oldTime: booking.time,
    masterId: booking.masterId || null
  };

  closeModal();
  toast.info("Выбери новую дату на календаре, потом время — и всё, перенесём");
};

/**
 * Отмена существующей записи клиента
 * @param {string} bookingId Идентификатор записи
 */
window.cancelOwnBooking = async (bookingId) => {
  if (!confirm("Вы действительно хотите отменить запись?")) return;

  try {
    const booking = store.bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error("Запись не найдена");

    await deleteDoc(doc(db, "bookings", bookingId));
    await sendTelegramNotification({ ...booking, action: "ОТМЕНА КЛИЕНТОМ" });

    store.bookings = store.bookings.filter(b => b.id !== bookingId);
    toast("Запись успешно отменена", "success");
    closeModal();
  } catch (err) {
    toast("Не удалось отменить запись", "error");
    console.error("Ошибка отмены записи:", err);
  }
};

/**
 * Создаёт новую запись (обычный режим, без переноса)
 */
window.bookAppointment = async () => {
  // Если вдруг режим переноса всё ещё активен — не должны сюда попадать, но на всякий
  if (isTransferMode) {
    await confirmTransfer();
    return;
  }

  const time = window.selectedTimeForBooking;
  const nameInput = document.getElementById("clientName");
  const phoneInput = document.getElementById("clientPhone");
  const serviceSelect = document.getElementById("service");

  if (!time || !nameInput?.value?.trim() || !phoneInput?.value?.trim() || !serviceSelect?.value) {
    toast("Пожалуйста, заполните все обязательные поля", "error");
    return;
  }

  const service = store.services.find(s => s.id === serviceSelect.value);
  if (!service) {
    toast("Выбранная услуга не найдена", "error");
    return;
  }

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, time, service.duration)) {
    toast("Выбранное время уже занято", "error");
    return;
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
    document.getElementById("successDetails").innerHTML = 
      `${new Date(currentModalDate).toLocaleDateString("ru-RU", {day:"numeric", month:"long"})} в <strong>${time}</strong><br>${service.name}`;
    toast("Запись успешно создана", "success");
    setTimeout(closeModal, 4000);

    setTimeout(() => {
      if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
      }
    }, 300);
  } catch (err) {
    toast("Не удалось создать запись", "error");
    console.error("Ошибка создания записи:", err);
  }
};

/**
 * Открывает модальное окно для создания новой записи (обычный режим)
 * @param {string} dateStr Дата в формате YYYY-MM-DD
 */
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
        <h3 style="color:var(--accent);font-size:2rem;">Записались!</h3>
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

/**
 * Отрисовывает временные слоты в модальном окне записи
 * @param {string} dateStr Дата в формате YYYY-MM-DD
 */
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

/**
 * Преобразует время в минуты с начала дня
 * @param {string} time Время в формате HH:MM
 * @returns {number} Количество минут
 */
const timeToMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Выбирает временной слот в модальном окне
 * @param {string} time Выбранное время
 * @param {HTMLElement} el Элемент слота
 */
window.selectTime = (time, el) => {
  const serviceSelect = document.getElementById("service");
  let duration = 60;

  // В режиме переноса serviceSelect может отсутствовать
  if (serviceSelect?.value) {
    const service = store.services.find(s => s.id === serviceSelect.value);
    duration = service?.duration || 60;
  } else if (isTransferMode && transferBookingData) {
    duration = transferBookingData.duration || 60;
  }

  if (window.isTimeOverlappingGlobal && window.isTimeOverlappingGlobal(currentModalDate, time, duration)) {
    toast("Выбранное время уже занято", "error");
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
  
  // В режиме переноса скрываем лишние поля
  if (!isTransferMode) {
    if (nameInput) nameInput.style.display = 'block';
    if (phoneInput) phoneInput.style.display = 'block';
    if (serviceEl) serviceEl.style.display = 'block';
  }

  if (finalStep) finalStep.style.display = 'block';

  const chosenTimeEl = document.getElementById('chosenTime');
  if (chosenTimeEl) {
    chosenTimeEl.textContent = `${time} (${duration} мин)`;
  }

  // В обычном режиме фокус на имя, в переносе — сразу на кнопку
  if (!isTransferMode) {
    nameInput?.focus();
  }
};

/**
 * Принудительное обновление выпадающего списка услуг в модальном окне
 */
function forceUpdateClientSelect() {
  const select = document.getElementById("service");
  if (!select) return;

  select.innerHTML = `<option value="">Выберите услугу</option>` +
    store.services.map(s => `<option value="${s.id}">${s.name} — ${s.price}₽ (${s.duration} мин)</option>`).join("");
}

// Экспорт основной функции
export { updateGlobalMasterSelect };

// Отладочное сообщение о успешной загрузке модуля
console.log("%cCOMPONENTS.JS — МОДУЛЬ ЗАГРУЖЕН С ПЕРЕНОСОМ ЗАПИСИ, БЛЯТЬ!", "color: lime; background: black; font-size: 24px; font-weight: bold");