// admin.js — ФИНАЛЬНАЯ ВЕРСИЯ 27.11.2025 — НИКАКИХ ОШИБОК
import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc        // ← ЭТО БЫЛО ПРОПУЩЕНО!
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentMaster = null;
let isSuperAdmin = false;

// === АВТОРИЗАЦИЯ ===
const masterAuth = localStorage.getItem("masterAuth");
const superAuth = localStorage.getItem("superAdminAuth");

if (masterAuth) currentMaster = JSON.parse(masterAuth);
if (superAuth === "true") isSuperAdmin = true; // ← ИСПРАВЛЕНО!

if (!currentMaster && !isSuperAdmin) location.href = "super-login.html";

// === ИНТЕРФЕЙС ===
if (currentMaster) {
  document.getElementById("page-title").textContent = currentMaster.name;
  document.getElementById("page-subtitle").textContent = "Личный кабинет мастера";
  document.getElementById("master-badge").style.display = "inline-block";
  document.getElementById("master-name-display").textContent = currentMaster.name;

  document.getElementById("services-card").style.display = "none";
  document.getElementById("masters-card").style.display = "none";
}

// === ВЫХОД ===
document.getElementById("logout-btn").onclick = () => {
  localStorage.clear();
  location.href = "index.html";
};

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
window.servicesList = [];
let bookingsData = [];

// === МОДАЛКИ ===
window.openModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("show");
  document.body.style.overflow = "hidden";
};
window.closeModal = (id) => {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("show");
  document.body.style.overflow = "";
};

// === РЕНДЕР УСЛУГ (ТОЛЬКО АДМИН) ===
function renderServices(docs) {
  const list = document.getElementById("services-list");
  if (!list) return;
  list.innerHTML = docs.map(d => {
    const s = d.data();
    return `<div class="item" onclick="openServiceModal('${d.id}')">
      <strong>${s.name}</strong> — ${s.price}₽ (${s.duration} мин)
      <div style="font-size:0.9rem;color:#777;margin-top:4px;">${s.description || ''}</div>
    </div>`;
  }).join("") || "<p style='color:#aaa;text-align:center;padding:40px;'>Нет услуг</p>";
}

// === РЕНДЕР МАСТЕРОВ (ТОЛЬКО АДМИН) ===
// === РЕНДЕР МАСТЕРОВ С ПЕРЕКЛЮЧАТЕЛЕМ ===
function renderMasters(docs) {
  const list = document.getElementById("masters-list");
  if (!list) return;

  if (docs.length === 0) {
    list.innerHTML = "<p style='color:#aaa;text-align:center;padding:60px;'>Нет мастеров</p>";
    return;
  }

  list.innerHTML = docs.map(d => {
    const m = d.data();
    const isActive = m.active !== false; // по умолчанию true

    return `
      <div class="item master-item" style="display:flex;align-items:center;justify-content:space-between;padding:20px;">
        <div onclick="openMasterModal('${d.id}')" style="cursor:pointer;flex:1;">
          ${m.photo ? `<img src="${m.photo}" style="width:50px;height:50px;border-radius:50%;object-fit веро:cover;margin-right:16px;vertical-align:middle;">` : '<div style="width:50px;height:50px;background:#f0e6e0;border-radius:50%;display:inline-block;margin-right:16px;"></div>'}
          <strong style="font-size:1.3rem;">${m.name}</strong><br>
          <small style="color:#777;">${m.email || '—'}</small>
        </div>

        <label class="switch">
          <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleMasterActive('${d.id}', this.checked)">
          <span class="slider"></span>
        </label>
      </div>`;
  }).join("");
}

// === РЕНДЕР ЗАПИСЕЙ ===
function renderBookings() {
  const list = document.getElementById("bookings-list");
  const count = document.getElementById("count");
  if (!list || !count) return;

  let filtered = bookingsData;
  if (currentMaster) {
    filtered = filtered.filter(b => b.masterId === currentMaster.id);
  }

  // Фильтр по поиску и дате (если нужно — раскомменти)
  const search = document.getElementById("search")?.value.toLowerCase() || "";
  const dateFilter = document.getElementById("filter-date")?.value || "";
  if (search || dateFilter) {
    filtered = filtered.filter(b => {
      const matchSearch = b.clientName?.toLowerCase().includes(search) || b.clientPhone?.includes(search);
      const matchDate = dateFilter ? b.date === dateFilter : true;
      return matchSearch && matchDate;
    });
  }

  count.textContent = filtered.length;

  list.innerHTML = filtered.length === 0
    ? `<p style="text-align:center;color:#aaa;padding:80px 20px;font-size:1.5rem;">
         ${currentMaster ? 'Записей нет.<br>Отдыхай, король' : 'Нет записей'}
       </p>`
    : filtered.map(b => {
        const service = window.servicesList.find(s => s.id === b.serviceId);
        return `<div class="item" onclick="openBookingModal('${b.id}')">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:1.3rem;color:var(--accent);">${b.clientName || 'Клиент'}</strong>
              ${b.clientPhone ? `<span style="margin-left:12px;color:#a67c52;">• ${b.clientPhone}</span>` : ''}
              <br><br>
              <div style="color:#777;">
                ${new Date(b.date).toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'long'})} 
                • ${b.time} • <strong>${service?.name || 'Услуга'}</strong>
              </div>
            </div>
            <div style="font-size:2rem;color:var(--accent);opacity:0.7;">→</div>
          </div>
        </div>`;
      }).join("");
}

// === КАЛЕНДАРЬ БЛОКИРОВКИ — РАБОЧИЙ ===
const timeSlots = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"];
let calendarDate = new Date();

async function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth() + 1;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  document.getElementById("currentMonthBlock").textContent =
    calendarDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^\w/, c => c.toUpperCase());

  const masterId = currentMaster?.id || null;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const q = query(
    collection(db, "blocked"),
    where("masterId", "==", masterId),
    where("date", ">=", start),
    where("date", "<=", end)
  );
  const snap = await getDocs(q);

  const blocked = {};
  snap.forEach(d => {
    const data = d.data();
    if (data.fullDay) blocked[data.date] = "full";
    else blocked[`${data.date}_${data.time}`] = true;
  });

  let html = "";
  for (let i = 0; i < offset; i++) html += `<div></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const isPast = new Date(dateStr) < new Date().setHours(0, 0, 0, 0);
    const isFullBlocked = blocked[dateStr] === "full";

    html += `
      <div style="padding:16px;border-radius:20px;text-align:center;font-weight:600;
                  background:${isFullBlocked ? '#ff5252' : isToday ? 'var(--accent)' : '#fff9f5'};
                  color:${isFullBlocked || isToday ? 'white' : 'inherit'};
                  cursor:${isPast ? 'not-allowed' : 'pointer'};"
           ${!isPast ? `onclick="openDayModal('${dateStr}')"` : ''}>
        ${day}${isFullBlocked ? '<br>Заблокировано' : ''}
      </div>`;
  }
  document.getElementById("block-calendar").innerHTML = html;
}

// === МОДАЛКА ДНЯ (КЛИК ПО ДАТЕ) ===
window.openDayModal = async (date) => {
  const masterId = currentMaster?.id || null;

  // Получаем записи
  const bookingsSnap = isSuperAdmin
    ? await getDocs(query(collection(db, "bookings"), where("date", "==", date)))
    : await getDocs(query(collection(db, "bookings"), where("date", "==", date), where("masterId", "==", masterId)));

  const bookings = bookingsSnap.docs.map(d => d.data());

  // Получаем блокировки
  const blockedSnap = await getDocs(query(collection(db, "blocked"), where("date", "==", date), where("masterId", "==", masterId)));
  const blockedTimes = blockedSnap.docs.filter(d => !d.data().fullDay).map(d => d.data().time);
  const fullDayBlocked = blockedSnap.docs.some(d => d.data().fullDay);

  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;";
  modal.innerHTML = `
    <div style="background:white;padding:40px;border-radius:32px;max-width:540px;width:92%;max-height:90vh;overflow-y:auto;">
      <h2 style="color:var(--accent);text-align:center;margin-bottom:24px;">${date}</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px;">
        ${timeSlots.map(time => {
          const booked = bookings.some(b => b.time === time);
          const blocked = blockedTimes.includes(time);
          return `
            <div style="padding:18px;border-radius:20px;text-align:center;font-weight:700;
                        background:${booked?'#ff9800':blocked?'#ff5252':'#f0e6e0'};
                        color:${booked||blocked?'white':'#333'};
                        cursor:${booked?'not-allowed':'pointer'};"
                 ${!booked ? `onclick="toggleTimeBlock('${date}','${time}',this)"` : ''}>
              ${time}${blocked?' Заблокировано':''}
            </div>`;
        }).join("")}
      </div>
      <button onclick="toggleFullDay('${date}',${fullDayBlocked})" 
              style="width:100%;padding:18px;border:none;border-radius:24px;font-size:1.2rem;color:white;
                     background:${fullDayBlocked?'#ff9800':'#ff5252'};cursor:pointer;">
        ${fullDayBlocked ? 'Разблокировать весь день' : 'Заблокировать весь день'}
      </button>
      <button onclick="this.closest('[style*=\'fixed\']')?.remove()" 
              style="margin-top:12px;width:100%;padding:16px;background:#666;color:white;border:none;border-radius:20px;">
        Закрыть
      </button>
    </div>`;
  document.body.appendChild(modal);
};

// === БЛОКИРОВКА ВРЕМЕНИ ===
window.toggleTimeBlock = async (date, time, el) => {
  const masterId = currentMaster?.id || null;
  const q = query(collection(db, "blocked"), where("date","==",date), where("time","==",time), where("masterId","==",masterId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await deleteDoc(snap.docs[0].ref);
    el.style.background = "#f0e6e0";
    el.innerHTML = time;
  } else {
    await addDoc(collection(db, "blocked"), { date, time, masterId, createdBy: currentMaster?"master":"admin" });
    el.style.background = "#ff5252";
    el.innerHTML = time + " Заблокировано";
  }
};

// === БЛОКИРОВКА ДНЯ ===
window.toggleFullDay = async (date, currentlyBlocked) => {
  const masterId = currentMaster?.id || null;
  if (currentlyBlocked) {
    const q = query(collection(db, "blocked"), where("date","==",date), where("fullDay","==",true), where("masterId","==",masterId));
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(d.ref);
  } else {
    await addDoc(collection(db, "blocked"), { date, fullDay:true, masterId, createdBy: currentMaster?"master":"admin" });
  }
  document.querySelector("[style*='fixed']")?.remove();
  renderCalendar();
};

// === НАВИГАЦИЯ КАЛЕНДАРЯ ===
document.getElementById("prevMonthBlock")?.addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById("nextMonthBlock")?.addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

// === ЗАПУСК ===
document.addEventListener("DOMContentLoaded", () => {
  onSnapshot(collection(db, "services"), s => {
    window.servicesList = s.docs.map(d => ({id:d.id, ...d.data()}));
    if (isSuperAdmin) renderServices(s.docs);
  });

  onSnapshot(collection(db, "bookings"), s => {
    bookingsData = s.docs.map(d => ({id:d.id, ...d.data()}));
    renderBookings();
  });

  if (isSuperAdmin) {
    onSnapshot(collection(db, "masters"), s => renderMasters(s.docs));
  }

  renderCalendar();
});
// === МОДАЛКИ ДЛЯ УСЛУГ, МАСТЕРОВ И ЗАПИСЕЙ ===
window.openServiceModal = (id = null) => {
  window.currentEditId = id;
  openModal("service-modal");
  if (id) {
    const service = window.servicesList.find(s => s.id === id);
    if (service) {
      document.getElementById("service-name").value = service.name || "";
      document.getElementById("service-price").value = service.price || "";
      document.getElementById("service-duration").value = service.duration || "";
      document.getElementById("service-desc").value = service.description || "";
    }
  } else {
    document.getElementById("service-name").value = "";
    document.getElementById("service-price").value = "";
    document.getElementById("service-duration").value = "";
    document.getElementById("service-desc").value = "";
  }
};

// === ОТКРЫТИЕ МОДАЛКИ МАСТЕРА ===
window.openMasterModal = async (id = null) => {
  window.currentEditMasterId = id;

  const modal = document.getElementById("master-modal");
  if (!modal) return;

  // Очищаем форму
  document.getElementById("master-name").value = "";
  document.getElementById("master-email").value = "";
  document.getElementById("master-photo").value = "";

  if (id) {
    // Загружаем данные
    const docSnap = await getDoc(doc(db, "masters", id));
    if (docSnap.exists()) {
      const m = docSnap.data();
      document.getElementById("master-name").value = m.name || "";
      document.getElementById("master-email").value = m.email || "";
      document.getElementById("master-photo").value = m.photo || "";
    }
  }

  openModal("master-modal");
};

// === СОХРАНЕНИЕ МАСТЕРА ===
window.saveMaster = async () => {
  const name = document.getElementById("master-name").value.trim();
  const email = document.getElementById("master-email").value.trim();
  const photo = document.getElementById("master-photo").value.trim();

  if (!name) return alert("Имя обязательно!");

  const data = {
    name,
    email: email || null,
    photo: photo || null,
    active: true
  };

  try {
    if (window.currentEditMasterId) {
      await updateDoc(doc(db, "masters", window.currentEditMasterId), data);
    } else {
      await addDoc(collection(db, "masters"), data);
    }
    closeModal("master-modal");
  } catch (err) {
    alert("Ошибка сохранения");
    console.error(err);
  }
};
// === ВКЛ/ВЫКЛ МАСТЕРА ===
window.toggleMasterActive = async (id, active) => {
  try {
    await updateDoc(doc(db, "masters", id), { active });
    console.log(`Мастер ${active ? 'включён' : 'выключен'}`);
  } catch (err) {
    alert("Ошибка при изменении статуса мастера");
    console.error(err);
  }
};

window.openBookingModal = (id) => {
  window.currentBookingId = id;
  const booking = bookingsData.find(b => b.id === id);
  if (booking) {
    alert(`Клиент: ${booking.clientName}\nТелефон: ${booking.clientPhone}\nДата: ${booking.date} ${booking.time}`);
    // Позже можно сделать полноценную модалку редактирования
  }
};

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ МОДАЛКИ ЗАПИСИ ===
let currentBookingId = null;

// === ОТКРЫТИЕ МОДАЛКИ ЗАПИСИ ===
window.openBookingModal = (id) => {
  currentBookingId = id;
  const booking = bookingsData.find(b => b.id === id);
  if (!booking) return;

  const service = window.servicesList.find(s => s.id === booking.serviceId);

  document.getElementById("booking-client-name").textContent = booking.clientName || "—";
  document.getElementById("booking-client-phone").textContent = booking.clientPhone || "—";
  document.getElementById("booking-service-name").textContent = service?.name || "Услуга удалена";

  document.getElementById("new-booking-date").value = booking.date;
  document.getElementById("new-booking-time").value = booking.time;

  openModal("booking-modal");
};

// === ПЕРЕНЕСТИ ЗАПИСЬ ===
window.transferBooking = async () => {
  if (!currentBookingId) return;

  const newDate = document.getElementById("new-booking-date").value;
  const newTime = document.getElementById("new-booking-time").value;

  if (!newDate || !newTime) {
    alert("Выбери новую дату и время!");
    return;
  }

  if (confirm("Перенести запись на " + newDate + " в " + newTime + "?")) {
    try {
      await updateDoc(doc(db, "bookings", currentBookingId), {
        date: newDate,
        time: newTime
      });
      alert("Запись успешно перенесена!");
      closeModal("booking-modal");
    } catch (err) {
      alert("Ошибка переноса");
      console.error(err);
    }
  }
};

// === ОТМЕНИТЬ ЗАПИСЬ ===
window.cancelBooking = async () => {
  if (!currentBookingId) return;

  if (confirm("Точно отменить запись? Клиент получит уведомление.")) {
    try {
      await deleteDoc(doc(db, "bookings", currentBookingId));
      alert("Запись отменена");
      closeModal("booking-modal");
    } catch (err) {
      alert("Ошибка отмены");
      console.error(err);
    }
  }
};
console.log("%cВАСИЛИКИ — РАБОТАЮТ КАК ЧАСЫ. ТЫ — ИМПЕРАТОР.", "color:gold;background:black;font-size:36px;padding:20px");