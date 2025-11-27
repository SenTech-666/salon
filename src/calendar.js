// src/calendar.js — ЧИСТАЯ ФИНАЛЬНАЯ ВЕРСИЯ НОЯБРЬ 2025
// Блокировка дня только по fullDay: true — без костылей и багов

import { store } from "./store.js";
import { todayISO, getClientId } from "./utils.js";

const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const renderCalendar = function () {
  const calendarEl = document.getElementById("calendar");
  const weekdaysEl = document.querySelector(".weekdays");
  if (!calendarEl || !weekdaysEl) return;

  const date = store.currentDate;
  const year = date.getFullYear();
  const month = date.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

  // Заголовок месяца
  document.getElementById("currentMonth").textContent =
    date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^\w/, c => c.toUpperCase());

  // Дни недели
  weekdaysEl.innerHTML = daysOfWeek.map(d => `<div>${d}</div>`).join("");

  // Пустые ячейки до первого дня
  let html = "";
  for (let i = 0; i < firstDayIndex; i++) html += `<div></div>`;

  // Дни месяца
  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateISO === todayISO;
    const isPast = dateISO < todayISO;

    // Записи клиента
    const dayBookings = store.bookings.filter(b => b.date === dateISO && b.time !== "00:00");
    const hasOwnBooking = dayBookings.some(b => b.clientId && b.clientId === store.clientId);
    const hasAnyBooking = dayBookings.length > 0;

    // Проверяем настоящую блокировку fullDay
    const isFullyBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay === true);
    const hasPartialBlock = store.blocked.some(b => b.date === dateISO && b.time && !b.fullDay);

    let classes = "day";
    let statusHtml = "";

    if (isPast) classes += " past";
    if (isToday) classes += " today";

    if (hasOwnBooking) {
      statusHtml = `<div class="status your-booking">Ваша запись</div>`;
      classes += " own";
    } else if (hasAnyBooking) {
      statusHtml = `<div class="status booked">Занято</div>`;
      classes += " booked";
    } else if (isFullyBlocked) {
      statusHtml = `<div class="status blocked">День закрыт</div>`;
      classes += " blocked-full";
    } else if (hasPartialBlock) {
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

  // Клик по дню — открываем модалку (только по свободным)
  calendarEl.onclick = (e) => {
    const dayEl = e.target.closest(".day");
    if (!dayEl?.dataset?.date) return;

    const date = dayEl.dataset.date;
    const isBlockedFull = dayEl.classList.contains("blocked-full");
    const isBooked = dayEl.classList.contains("booked");
    const isPastDay = dayEl.classList.contains("past");

    if (isPastDay || isBooked || isBlockedFull) return;

    if (typeof window.showBookingModal === "function") {
      window.showBookingModal(date);
    }
  };
};

// Навигация по месяцам
document.getElementById("prevMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.prevMonth()).then(renderCalendar);
});

document.getElementById("nextMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.nextMonth()).then(renderCalendar);
});

// Первый рендер после получения clientId
getClientId().then(id => {
  store.clientId = id;
  renderCalendar();
});