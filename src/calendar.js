// src/calendar.js — ФИНАЛЬНАЯ ВЕРСИЯ 28.11.2025 — ЗАГРУЖЕННОСТЬ ДНЯ ВЕРНУЛАСЬ НАВСЕГДА, СУКА!
console.log("%cКАЛЕНДАРЬ 28.11.2025 — ЗАГРУЖЕННОСТЬ ДНЯ РАБОТАЕТ КАК У БОГА. КАЖДЫЙ МАСТЕР — СВОЯ ТЕРРИТОРИЯ.", "color: lime; background: black; font-size: 28px; font-weight: bold");

import { store } from "./store.js";
import { todayISO, getClientId } from "./utils.js";

const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Адаптив
function updateCSSVariables() {
  const width = window.innerWidth;
  let cellSize = "150px", gapSize = "14px";

  if (width <= 480) {
    cellSize = `calc((100vw - 40px - 6 * 6px) / 7)`;
    gapSize = "6px";
  } else if (width <= 768) {
    cellSize = `calc((100vw - 60px - 6 * 8px) / 7)`;
    gapSize = "8px";
  }

  document.documentElement.style.setProperty('--cell', cellSize);
  document.documentElement.style.setProperty('--gap', gapSize);
}

updateCSSVariables();
window.addEventListener('resize', () => {
  updateCSSVariables();
  renderCalendar();
});

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ===
window.getRelevantBookings = (dateISO = null) => {
  const selected = window.selectedGlobalMasterId;

  return store.bookings.filter(b => {
    if (dateISO && b.date !== dateISO) return false;

    if (selected) {
      return b.masterId === selected;
    } else {
      return !b.masterId; // общий график — только записи без мастера
    }
  });
};

window.isSlotTaken = (dateISO, time) => {
  const blocked = store.blocked.some(b => b.date === dateISO && b.time === time);
  if (blocked) return true;

  const bookings = window.getRelevantBookings(dateISO);
  const slotMin = timeToMinutes(time);

  return bookings.some(b => {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration || 60);
    return slotMin < bEnd && (slotMin + 30) > bStart; // 30 мин слот, но адаптировать под duration
  });
};

window.isTimeOverlappingGlobal = (dateISO, startTime, duration) => {
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + duration;

  const bookings = window.getRelevantBookings(dateISO);
  return bookings.some(b => {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + b.duration;
    return startMin < bEnd && endMin > bStart;
  });
};

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// === РЕНДЕР КАЛЕНДАРЯ ===
export const renderCalendar = () => {
  const monthEl = document.getElementById("currentMonth");
  if (!monthEl) return;

  const year = store.currentDate.getFullYear();
  const month = store.currentDate.getMonth();
  monthEl.textContent = store.currentDate.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  let html = "";
  const padDays = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < padDays; i++) {
    html += `<div class="day empty"></div>`;
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    let classes = "day";
    let statusHtml = "";

    const isPast = dateISO < today;
    if (isPast) classes += " past";

    const isToday = dateISO === today;
    if (isToday) classes += " today";

    const fullDayBlocked = store.blocked.some(b => b.date === dateISO && b.fullDay);
    if (fullDayBlocked) {
      classes += " blocked-full";
      statusHtml = `<div class="status blocked">Закрыто</div>`;
    } else {
      const dayBookings = window.getRelevantBookings(dateISO);
      const isOwn = dayBookings.some(b => b.clientId === store.clientId);

      if (isOwn) {
        classes += " own";
      } else if (dayBookings.length >= 12) { // assuming 12 slots per day
        classes += " booked";
        statusHtml = `<div class="status booked">Нет мест</div>`;
      } else if (dayBookings.length > 0) {
        classes += " partial";
        statusHtml = ""; // минимализм
      } else {
        statusHtml = `<div class="status free">Свободно</div>`;
      }
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

// Делаем глобальной для прямого вызова
window.renderCalendar = renderCalendar;

// Навигация
document.getElementById("prevMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.prevMonth()).then(window.renderCalendar);
});

document.getElementById("nextMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => m.nextMonth()).then(window.renderCalendar);
});

// Инициализация clientId
getClientId().then(id => {
  store.clientId = id;
  window.renderCalendar();
});

console.log("%cLUNARO 2025 — КАЛЕНДАРЬ НЕПРОБИВАЕМЫЙ. ЗАГРУЖЕННОСТЬ, МОДАЛКИ, МАСТЕРА — ВСЁ ЕБЁТ!", "color: gold; background: black; font-size: 26px; font-weight: bold");