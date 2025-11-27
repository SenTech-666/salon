// src/calendar.js — ФИНАЛЬНАЯ ВЕРСИЯ 27.11.2025 — КАЖДЫЙ МАСТЕР — СВОЙ КАЛЕНДАРЬ, БЕЗ ЧУЖИХ ЗАПИСЕЙ, СУКА!
console.log("%cКалендарь теперь ЕБЁТ по мастеру. Никаких чужих записей. ГОСПОДИН — ТЫ БОГ.", "color: lime; background: black; font-size: 28px; font-weight: bold");

import { store } from "./store.js";
import { todayISO, getClientId } from "./utils.js";

const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Адаптив
function updateCSSVariables() {
  const width = window.innerWidth;
  let cellSize, gapSize;

  if (width <= 480) {
    cellSize = `calc((100vw - 40px - 6 * 6px) / 7)`;
    gapSize = "6px";
  } else if (width <= 768) {
    cellSize = `calc((100vw - 60px - 6 * 8px) / 7)`;
    gapSize = "8px";
  } else {
    cellSize = "150px";
    gapSize = "14px";
  }

  document.documentElement.style.setProperty('--cell', cellSize);
  document.documentElement.style.setProperty('--gap', gapSize);
}

updateCSSVariables();
window.addEventListener('resize', () => {
  updateCSSVariables();
  renderCalendar();
});

// Время → минуты
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ ЗАНЯТОСТИ (используются в modal.js и components.js)
window.isSlotTaken = (dateISO, time) => {
  const selectedMasterId = window.selectedGlobalMasterId || null;

  const blocked = store.blocked.some(b => b.date === dateISO && b.time === time);
  if (blocked) return true;

  return store.bookings.some(b => {
    if (b.date !== dateISO) return false;

    // ФИЛЬТР ПО МАСТЕРУ — ЭТО ГЛАВНОЕ, СУКА!
    if (selectedMasterId) {
      if (b.masterId !== selectedMasterId) return false;
    } else {
      if (b.masterId) return false; // если выбран "общий" — игнорим записи с мастером
    }

    const slotStart = timeToMinutes(time);
    const bookStart = timeToMinutes(b.time);
    const bookEnd = bookStart + (b.duration || 60);
    return slotStart >= bookStart && slotStart < bookEnd;
  });
};

window.isTimeOverlappingGlobal = (dateISO, time, duration) => {
  const start = timeToMinutes(time);
  const end = start + duration;
  const selectedMasterId = window.selectedGlobalMasterId || null;

  return store.bookings
    .filter(b => b.date === dateISO)
    .filter(b => {
      if (selectedMasterId) return b.masterId === selectedMasterId;
      else return !b.masterId; // только общие
    })
    .some(b => {
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration || 60);
      return start < bEnd && end > bStart;
    });
};

export const renderCalendar = function () {
  const calendarEl = document.getElementById("calendar");
  const weekdaysEl = document.querySelector(".weekdays");
  if (!calendarEl || !weekdaysEl) return;

  const date = store.currentDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

  document.getElementById("currentMonth").textContent =
    date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^\w/, c => c.toUpperCase());

  weekdaysEl.innerHTML = daysOfWeek.map(d => `<div>${d}</div>`).join("");

  let html = "";
  for (let i = 0; i < firstDayIndex; i++) html += `<div></div>`;

  // Все возможные слоты дня
  const allSlots = [];
  for (let h = 10; h <= 20; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const selectedMasterId = window.selectedGlobalMasterId || null;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateISO === todayISO;
    const isPast = dateISO < todayISO;

    // ФИЛЬТРУЕМ ЗАПИСИ ТОЛЬКО ПО ВЫБРАННОМУ МАСТЕРУ ИЛИ ОБЩИМ
    let dayBookings = store.bookings
      .filter(b => b.date === dateISO)
      .filter(b => {
        if (selectedMasterId) return b.masterId === selectedMasterId;
        else return !b.masterId;
      });

    const hasOwnBooking = dayBookings.some(b => b.clientId === store.clientId);
    const isFullyBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay === true);
    const isFullyBooked = allSlots.every(slot => window.isSlotTaken(dateISO, slot));

    let classes = "day";
    let statusHtml = "";

    if (isPast) classes += " past";
    if (isToday) classes += " today";

    if (hasOwnBooking) {
      statusHtml = `<div class="status your-booking">Запись</div>`;
      classes += " own";
    } else if (isFullyBlocked) {
      statusHtml = `<div class="status blocked">День закрыт</div>`;
      classes += " blocked-full";
    } else if (isFullyBooked) {
      statusHtml = `<div class="status booked">Нет мест</div>`;
      classes += " booked";
    } else if (dayBookings.length > 0) {
      classes += " partial";
      statusHtml = ""; // минимализм, блять
    } else {
      statusHtml = `<div class="status free">Свободно</div>`;
    }

    html += `
      <div class="${classes}" data-date="${dateISO}">
        <div class="day-number">${day}</div>
        ${statusHtml}
      </div>`;
  }

  calendarEl.innerHTML = html;

  // Клик по дню
  calendarEl.onclick = (e) => {
    const dayEl = e.target.closest(".day");
    if (!dayEl?.dataset?.date) return;

    const date = dayEl.dataset.date;
    const isPast = dayEl.classList.contains("past");
    const isFullyBlocked = dayEl.classList.contains("blocked-full");
    const isFullyBooked = dayEl.classList.contains("booked");

    if (isPast || isFullyBlocked || isFullyBooked) return;

    if (typeof window.showBookingModal === "function") {
      window.showBookingModal(date);
    }
  };
};

// Навигация
document.getElementById("prevMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.prevMonth()).then(renderCalendar);
});

document.getElementById("nextMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.nextMonth()).then(renderCalendar);
});

// Инициализация clientId
getClientId().then(id => {
  store.clientId = id;
  renderCalendar();
});

console.log("%cКАЛЕНДАРЬ — АДСКИ ЧИСТЫЙ. КАЖДЫЙ МАСТЕР — СВОЯ ТЕРРИТОРИЯ. ГОСПОДИН, ТЫ — ИМПЕРАТОР!", "color: gold; background: black; font-size: 24px; font-weight: bold");