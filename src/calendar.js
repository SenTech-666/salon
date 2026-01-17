// src/calendar.js
// Модуль рендеринга интерактивного календаря записи
// Реализует отображение дней месяца, статусы занятости, горизонт записи вперёд,
// адаптивность под мобильные устройства и обработку кликов по дням

import { store } from "./store.js";
import { todayISO, getClientId } from "./utils.js";

// Массив названий дней недели для отображения в шапке календаря
const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Обновление CSS-переменных для адаптивного размера ячеек календаря
function updateCSSVariables() {
  const width = window.innerWidth;
  let cellSize = "150px";
  let gapSize = "14px";

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

// Инициализация адаптивных размеров при загрузке и изменении размера окна
updateCSSVariables();
window.addEventListener('resize', () => {
  updateCSSVariables();
  if (typeof window.renderCalendar === 'function') {
    window.renderCalendar();
  }
});

// Глобальные вспомогательные функции

/**
 * Возвращает массив записей, релевантных для текущего выбранного мастера
 * @param {string|null} dateISO Опциональная дата в формате YYYY-MM-DD
 * @returns {Array} Массив подходящих записей
 */
window.getRelevantBookings = (dateISO = null) => {
  const selectedMaster = window.selectedGlobalMasterId;

  return store.bookings.filter(booking => {
    if (dateISO && booking.date !== dateISO) return false;
    return selectedMaster 
      ? booking.masterId === selectedMaster 
      : !booking.masterId; // Общий график — записи без мастера
  });
};

/**
 * Проверяет, занято ли конкретное время на указанную дату
 * @param {string} dateISO Дата в формате YYYY-MM-DD
 * @param {string} time Время в формате HH:MM
 * @returns {boolean} true — если слот занят или заблокирован
 */
window.isSlotTaken = (dateISO, time) => {
  if (!dateISO || !time) return false;

  // Проверка блокировки конкретного времени
  const isBlocked = store.blocked?.some?.(b => b.date === dateISO && b.time === time) ?? false;
  if (isBlocked) return true;

  const bookings = window.getRelevantBookings(dateISO);
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + 30; // Минимальный слот 30 минут

  return bookings.some(b => {
    const bookingStart = timeToMinutes(b.time);
    const bookingEnd = bookingStart + (b.duration || 60);
    return slotStart < bookingEnd && slotEnd > bookingStart;
  });
};

/**
 * Проверяет пересечение нового интервала времени с существующими записями
 * @param {string} dateISO Дата
 * @param {string} startTime Начальное время
 * @param {number} duration Продолжительность в минутах
 * @returns {boolean} true — если есть пересечение
 */
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

/**
 * Преобразует строку времени в минуты с начала дня
 * @param {string} time Время в формате HH:MM
 * @returns {number} Минуты
 */
const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Форматирует объект Date в строку YYYY-MM-DD
 * @param {Date} date Объект даты
 * @returns {string} Дата в формате YYYY-MM-DD
 */
const formatDate = (date) => date.toISOString().split('T')[0];

/**
 * Основная функция рендеринга календаря
 * Формирует сетку дней текущего месяца с учётом статусов, горизонта записи и прав пользователя
 */
export const renderCalendar = () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    console.warn("Контейнер календаря #calendar не найден в DOM");
    return;
  }

  // Обновляем заголовок месяца и года
  const monthEl = document.getElementById("currentMonth");
  if (monthEl) {
    monthEl.textContent = store.currentDate.toLocaleString("ru-RU", { 
      month: "long", 
      year: "numeric" 
    });
  }

  const year = store.currentDate.getFullYear();
  const month = store.currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Количество пустых ячеек в начале месяца (с учётом, что неделя начинается с Пн)
  const paddingDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  let html = "";

  // Добавляем пустые ячейки в начале месяца
  for (let i = 0; i < paddingDays; i++) {
    html += `<div class="day empty"></div>`;
  }

  const now = new Date();
  const today = formatDate(now);

  // Горизонт записи вперёд (максимальное количество дней, доступных для бронирования)
  const maxDaysAhead = store.settings?.maxBookingDaysAhead ?? 90;
  const horizonDate = new Date(now);
  horizonDate.setDate(horizonDate.getDate() + maxDaysAhead);

  // Генерация ячеек для каждого дня месяца
  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    const dayDate = new Date(dateISO);

    let classes = "day";
    let statusHtml = `<div class="day-number">${day}</div>`;

    const isPast = dateISO < today;
    if (isPast) classes += " past";

    const isTooFar = dayDate > horizonDate;
    if (isTooFar) classes += " too-far";

    if (dateISO === today) classes += " today";

    const isFullDayBlocked = store.blocked?.some?.(b => b.date === dateISO && b.fullDay) ?? false;

    if (isFullDayBlocked) {
      classes += " blocked-full";
      statusHtml += `<div class="status blocked">Закрыто</div>`;
    } else {
      const dayBookings = window.getRelevantBookings?.(dateISO) ?? [];
      const isOwnBooking = dayBookings.some(b => b.clientId === store.clientId);

      if (isOwnBooking) {
        classes += " own";
        statusHtml += `<div class="status own">Ваша</div>`;
      } else if (dayBookings.length >= 12) { // Порог "полностью занято" — можно настраивать
        classes += " booked";
        statusHtml += `<div class="status booked">Нет мест</div>`;
      } else if (dayBookings.length > 0) {
        classes += " partial";
        statusHtml += `<div class="status partial">${dayBookings.length}</div>`;
      } else {
        statusHtml += `<div class="status free">Свободно</div>`;
      }

      // Перекрывающий статус для дат за горизонтом
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

  // Обработчик кликов по дням календаря
  calendarEl.onclick = (event) => {
    const dayElement = event.target.closest(".day");
    if (!dayElement?.dataset?.date) return;

    if (dayElement.classList.contains("too-far")) {
      window.toast?.("Запись на эту дату пока закрыта", "warning");
      return;
    }

    const selectedDate = dayElement.dataset.date;
    const isPastDay = dayElement.classList.contains("past");
    const isFullyBlocked = dayElement.classList.contains("blocked-full");
    const isFullyBooked = dayElement.classList.contains("booked");

    if (isPastDay || isFullyBlocked || isFullyBooked) return;

    if (typeof window.showBookingModal === "function") {
      window.showBookingModal(selectedDate);
    } else {
      console.warn("Функция showBookingModal не определена");
    }
  };

  console.log(`%cКалендарь успешно отрисован | выбран мастер: ${window.selectedGlobalMasterId || 'Общий'} | дней в месяце: ${daysInMonth} | горизонт: ${maxDaysAhead} дней`, 
    'color:#00ccff; background:#000;');
};

// Делаем функцию рендеринга доступной глобально
window.renderCalendar = renderCalendar;

// Навигация по месяцам (предыдущий)
document.getElementById("prevMonth")?.addEventListener("click", () => {
  import("./store.js").then(module => {
    if (typeof module.prevMonth === "function") {
      module.prevMonth();
      window.renderCalendar();
    }
  }).catch(err => console.error("Ошибка динамического импорта store.js (prevMonth):", err));
});

// Навигация по месяцам (следующий)
document.getElementById("nextMonth")?.addEventListener("click", () => {
  import("./store.js").then(module => {
    if (typeof module.nextMonth === "function") {
      module.nextMonth();
      window.renderCalendar();
    }
  }).catch(err => console.error("Ошибка динамического импорта store.js (nextMonth):", err));
});

// Инициализация идентификатора клиента и первый рендер календаря
getClientId().then(id => {
  store.clientId = id;
  if (typeof window.renderCalendar === "function") {
    window.renderCalendar();
  }
}).catch(err => {
  console.error("Ошибка инициализации идентификатора клиента:", err);
});

// Отладочное сообщение о успешной загрузке модуля (можно удалить в production)
console.log("%cКАЛЕНДАРЬ 2026 — МОДУЛЬ ЗАГРУЖЕН И ГОТОВ К РАБОТЕ", "color: gold; background: black; font-size: 24px; font-weight: bold");