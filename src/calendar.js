// src/calendar.js — ФИНАЛЬНАЯ ВЕРСИЯ с горизонтом записи (16.01.2026)
// ЗАГРУЖЕННОСТЬ ДНЯ РАБОТАЕТ КАК У БОГА. КАЖДЫЙ МАСТЕР — СВОЯ ТЕРРИТОРИЯ.
// + ОГРАНИЧЕНИЕ ЗАПИСИ ВПЕРЁД (maxBookingDaysAhead)

console.log("%cКАЛЕНДАРЬ 16.01.2026 — ГОРИЗОНТ ЗАПИСИ ВЪЕБАН НА МЕСТО", "color: lime; background: black; font-size: 28px; font-weight: bold");

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
  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  }
});

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ===
window.getRelevantBookings = (dateISO = null) => {
  const selected = window.selectedGlobalMasterId;

  console.log(`%cgetRelevantBookings вызван | мастер: ${selected || 'Общий'} | дата: ${dateISO || 'все'}`, 'color:#ffcc00; background:#000;');

  return store.bookings.filter(b => {
    if (dateISO && b.date !== dateISO) return false;
    return selected ? b.masterId === selected : !b.masterId;
  });
};

window.isSlotTaken = (dateISO, time) => {
  if (!dateISO || !time) return false;

  const blocked = store.blocked?.some?.(b => b.date === dateISO && b.time === time) ?? false;
  if (blocked) return true;

  const bookings = window.getRelevantBookings(dateISO);
  const slotMin = timeToMinutes(time);

  return bookings.some(b => {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration || 60);
    return slotMin < bEnd && (slotMin + 30) > bStart;
  });
};

window.isTimeOverlappingGlobal = (dateISO, startTime, duration) => {
  if (!dateISO || !startTime || !duration) return false;

  const startMin = timeToMinutes(startTime);
  const endMin = startMin + duration;

  const bookings = window.getRelevantBookings(dateISO);
  return bookings.some(b => {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration || 60);
    return startMin < bEnd && endMin > bStart;
  });
};

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const formatDate = (date) => date.toISOString().split('T')[0];

// === РЕНДЕР КАЛЕНДАРЯ ===
export const renderCalendar = () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    console.warn("Элемент #calendar не найден в DOM");
    return;
  }

  const monthEl = document.getElementById("currentMonth");
  if (monthEl) {
    monthEl.textContent = store.currentDate.toLocaleString("ru-RU", { month: "long", year: "numeric" });
  }

  const year = store.currentDate.getFullYear();
  const month = store.currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const padDays = firstDay === 0 ? 6 : firstDay - 1;

  let html = "";
  for (let i = 0; i < padDays; i++) {
    html += `<div class="day empty"></div>`;
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // ────────────────────────────────────────────────
  // Горизонт записи — сколько дней вперёд можно бронировать
  const maxDaysAhead = store.settings?.maxBookingDaysAhead ?? 90; // дефолт 90 дней
  const horizonDate = new Date(now);
  horizonDate.setDate(horizonDate.getDate() + maxDaysAhead);
  // ────────────────────────────────────────────────

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    // Проверка горизонта
    const dayDate = new Date(dateISO);
    const isTooFar = dayDate > horizonDate;

    let classes = "day";
    let statusHtml = `<div class="day-number">${day}</div>`;

    const isPast = dateISO < today;
    if (isPast) classes += " past";

    if (isTooFar) classes += " too-far";

    const isToday = dateISO === today;
    if (isToday) classes += " today";

    const fullDayBlocked = store.blocked?.some?.(b => b.date === dateISO && b.fullDay) ?? false;
    if (fullDayBlocked) {
      classes += " blocked-full";
      statusHtml += `<div class="status blocked">Закрыто</div>`;
    } else {
      const dayBookings = window.getRelevantBookings?.(dateISO) ?? [];
      const isOwn = dayBookings.some(b => b.clientId === store.clientId);

      if (isOwn) {
        classes += " own";
        statusHtml += `<div class="status own">Ваша</div>`;
      } else if (dayBookings.length >= 12) {
        classes += " booked";
        statusHtml += `<div class="status booked">Нет мест</div>`;
      } else if (dayBookings.length > 0) {
        classes += " partial";
        statusHtml += `<div class="status partial">${dayBookings.length}</div>`;
      } else {
        statusHtml += `<div class="status free">Свободно</div>`;
      }

      // Перекрываем статус, если слишком далеко
      if (isTooFar) {
        statusHtml += `<div class="status too-far">Запись закрыта</div>`;
      }
    }

    html += `
      <div class="${classes}" data-date="${dateISO}">
        ${statusHtml}
      </div>`;
  }

  calendarEl.innerHTML = html;

  // Клик по любой ячейке .day
  calendarEl.onclick = (e) => {
    const dayEl = e.target.closest(".day");
    if (!dayEl?.dataset?.date) return;

    // Блокировка для слишком дальних дат
    if (dayEl.classList.contains("too-far")) {
      window.toast?.("Запись на эту дату пока закрыта", "warning");
      return;
    }

    const date = dayEl.dataset.date;
    const isPast = dayEl.classList.contains("past");
    const isFullyBlocked = dayEl.classList.contains("blocked-full");
    const isFullyBooked = dayEl.classList.contains("booked");

    if (isPast || isFullyBlocked || isFullyBooked) return;

    if (typeof window.showBookingModal === "function") {
      window.showBookingModal(date);
    } else {
      console.warn("window.showBookingModal не определена");
    }
  };

  console.log(`%crenderCalendar выполнен | мастер: ${window.selectedGlobalMasterId || 'Общий'} | дней: ${daysInMonth} | горизонт: ${maxDaysAhead} дней`, 'color:#00ccff; background:#000;');
};

// Делаем глобальной для вызова из других файлов
window.renderCalendar = renderCalendar;

// Навигация по месяцам
document.getElementById("prevMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => {
    if (typeof m.prevMonth === "function") {
      m.prevMonth();
      window.renderCalendar();
    }
  }).catch(err => console.error("Ошибка импорта store.js (prevMonth)", err));
});

document.getElementById("nextMonth")?.addEventListener("click", () => {
  import("./store.js").then(m => {
    if (typeof m.nextMonth === "function") {
      m.nextMonth();
      window.renderCalendar();
    }
  }).catch(err => console.error("Ошибка импорта store.js (nextMonth)", err));
});

// Инициализация clientId + первый рендер
getClientId().then(id => {
  store.clientId = id;
  if (typeof window.renderCalendar === "function") {
    window.renderCalendar();
  }
}).catch(err => {
  console.error("Ошибка инициализации clientId", err);
});

console.log("%cLUNARO 2026 — КАЛЕНДАРЬ С ГОРИЗОНТОМ, БЛЯТЬ! НИЧЕГО НЕ СЛОМАНО", "color: gold; background: black; font-size: 26px; font-weight: bold");