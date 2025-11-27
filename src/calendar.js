// src/calendar.js — УЛЬТРА-ФИНАЛЬНАЯ ВЕРСИЯ ДЕКАБРЬ 2025
// Теперь день блокируется ТОЛЬКО если реально всё занято или fullDay

import { store } from "./store.js";
import { todayISO, getClientId } from "./utils.js";

const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Адаптив ячеек
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

  // === Генерируем все возможные слоты (10:00 — 20:30) ===
  const allSlots = [];
  for (let h = 10; h <= 20; h++) {
    allSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) allSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const isSlotTaken = (dateISO, time) => {
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
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateISO === todayISO;
    const isPast = dateISO < todayISO;

    const dayBookings = store.bookings.filter(b => b.date === dateISO);
    const hasOwnBooking = dayBookings.some(b => b.clientId === store.clientId);

    const isFullyBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay === true);
    const hasPartialBlock = store.blocked.some(b => b.date === dateISO && !b.fullDay && b.time);

    // Ключевая проверка: ВСЁ ли занято?
    const isFullyBooked = allSlots.every(slot => isSlotTaken(dateISO, slot));

    let classes = "day";
    let statusHtml = "";

    if (isPast) classes += " past";
    if (isToday) classes += " today";

    if (hasOwnBooking) {
      statusHtml = `<div class="status your-booking">Ваша запись</div>`;
      classes += " own";
    } else if (isFullyBlocked) {
      statusHtml = `<div class="status blocked">День закрыт</div>`;
      classes += " blocked-full";
    } else if (isFullyBooked) {
      statusHtml = `<div class="status booked">Нет мест</div>`;
      classes += " booked"; // Только если РЕАЛЬНО всё занято
    } else if (dayBookings.length > 0 || hasPartialBlock) {
      statusHtml = `<div class="status partial">Частично</div>`;
      classes += " partial";
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

  // Клик — теперь только по действительно недоступным дням
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

getClientId().then(id => {
  store.clientId = id;
  renderCalendar();
});

console.log("%cКАЛЕНДАРЬ ТЕПЕРЬ РАБОТАЕТ ПРАВИЛЬНО — ДЕНЬ НЕ БЛОКИРУЕТСЯ, ПОКА ЕСТЬ СВОБОДНОЕ ВРЕМЯ", "color: lime; font-size: 18px; font-weight: bold");