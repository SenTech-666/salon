console.log("%cДЕБАГ АДМИНКИ 2026 — ПОЛНЫЙ КОМПЛЕКТ, СУКА!", "color:red;font-size:30px");
console.log("window.isSuperAdmin =", window.isSuperAdmin);
console.log("localStorage superAdminAuth =", localStorage.getItem("superAdminAuth"));
console.log("Текущий user:", auth.currentUser?.email);

// admin.js — ВАСИЛИКИ 2026 — АДМИНКА С ФИЛЬТРАМИ И МАССОВЫМИ ДЕЙСТВИЯМИ (15.01.2026)

import { db, auth } from "./firebase-config.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// Глобальные переменные
let currentMaster = null;
let isSuperAdmin = false;

window.servicesList = [];
window.mastersList = [];
let bookingsData = [];

const SUPER_ADMIN_EMAILS = [
  "prointernat07@gmail.com",
  "admin@vasiliki.ru"
];

let selectedBookings = new Set(); // для массовых действий

// === МОДАЛКИ ===
window.openModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
};

window.closeModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("show");
  document.body.style.overflow = "";
};

// Автозакрытие модалок
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".close").forEach(el => {
    el.addEventListener("click", () => {
      const modal = el.closest(".modal");
      if (modal) closeModal(modal.id);
    });
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelector(".modal.show")?.classList.remove("show");
      document.body.style.overflow = "";
    }
  });

  document.getElementById("logout-btn").onclick = window.firebaseSignOut;
});

// === ИНТЕРФЕЙС ДЛЯ МАСТЕРА ===
function setupInterface() {
  if (currentMaster) {
    document.getElementById("page-title").textContent = currentMaster.name;
    document.getElementById("page-subtitle").textContent = "Личный кабинет мастера";
    document.getElementById("master-badge").style.display = "inline-block";
    document.getElementById("master-name-display").textContent = currentMaster.name;

    document.getElementById("services-card").style.display = "none";
    document.getElementById("masters-card").style.display = "none";

    document.querySelectorAll(".btn").forEach(btn => {
      if (btn.textContent.includes("Добавить")) {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
        btn.title = "Доступно только администратору";
      }
    });
  }
}

// === ЗАПОЛНЕНИЕ ФИЛЬТРА МАСТЕРОВ ===
function populateMasterFilter() {
  const select = document.getElementById("filter-master");
  if (!select) return;

  select.innerHTML = '<option value="">Все мастера</option>';

  // Сортируем мастеров по имени для удобства
  const sortedMasters = [...window.mastersList].sort((a, b) => a.name.localeCompare(b.name));

  sortedMasters.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
}

// === РЕНДЕР УСЛУГ ===
function renderServices() {
  const el = document.getElementById("services-list");
  el.innerHTML = window.servicesList.length === 0
    ? "<p style='color:#aaa;text-align:center;padding:60px;'>Нет услуг</p>"
    : window.servicesList.map(s => `
      <div class="item" onclick="openServiceModal('${s.id}')">
        <strong>${s.name}</strong> — ${s.price}₽ (${s.duration} мин)
        <div style="font-size:0.9rem;color:#777;margin-top:4px;">${s.description || ''}</div>
      </div>
    `).join("");
}

// === РЕНДЕР МАСТЕРОВ ===
function renderMasters(docs) {
  const el = document.getElementById("masters-list");
  el.innerHTML = docs.length === 0
    ? "<p style='color:#aaa;text-align:center;padding:60px;'>Нет мастеров</p>"
    : docs.map(d => {
        const m = d.data();
        const isActive = m.active !== false;
        return `
          <div class="item master-item" style="display:flex;align-items:center;justify-content:space-between;padding:20px;">
            <div onclick="openMasterModal('${d.id}')" style="cursor:pointer;flex:1;display:flex;align-items:center;">
              ${m.photo ? `<img src="${m.photo}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-right:16px;">` : '<div style="width:50px;height:50px;background:#f0e6e0;border-radius:50%;margin-right:16px;"></div>'}
              <div>
                <strong style="font-size:1.3rem;">${m.name}</strong><br>
                <small style="color:#777;">${m.email || '—'}</small>
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleMasterActive('${d.id}', this.checked)">
              <span class="slider"></span>
            </label>
          </div>`;
      }).join("");
}

// === РЕНДЕР ЗАПИСЕЙ (С ЧЕКБОКСАМИ, ФИЛЬТРАМИ И КРАСИВЫМ ВИДОМ) ===
function renderBookings() {
  const search = document.getElementById("search")?.value?.toLowerCase() || '';
  const dateFilter = document.getElementById("filter-date")?.value || '';
  const masterFilter = document.getElementById("filter-master")?.value || '';

  let filtered = bookingsData;

  // Фильтр по поиску
  if (search) {
    filtered = filtered.filter(b =>
      (b.clientName?.toLowerCase().includes(search) ||
       b.clientPhone?.includes(search) ||
       b.serviceName?.toLowerCase().includes(search))
    );
  }

  // Фильтр по дате
  if (dateFilter) {
    filtered = filtered.filter(b => b.date === dateFilter);
  }

  // Фильтр по мастеру
  if (masterFilter) {
    filtered = filtered.filter(b => b.masterId === masterFilter);
  } else if (currentMaster) {
    // Если залогинен мастер — только его записи
    filtered = filtered.filter(b => b.masterId === currentMaster.id);
  }

  document.getElementById("count").textContent = filtered.length;

  const list = document.getElementById("bookings-list");
  list.innerHTML = filtered.length === 0
    ? `<p style="text-align:center;color:#aaa;padding:80px 20px;font-size:1.5rem;">
         ${currentMaster ? 'Записей нет.<br>Отдыхай, король' : 'Нет записей'}
       </p>`
    : filtered.map(b => {
        const service = window.servicesList.find(s => s.id === b.serviceId);
        const masterName = b.masterId 
          ? window.mastersList.find(m => m.id === b.masterId)?.name || 'Общий график' 
          : 'Общий график';

        return `
          <div class="item" style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid #eee;cursor:pointer;">
            <input type="checkbox" 
                   onchange="toggleBookingSelection('${b.id}', this.checked)" 
                   style="width:20px;height:20px;">
            <div onclick="openBookingModal('${b.id}')" style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:1.3rem;color:var(--accent);">${b.clientName || 'Клиент'}</strong>
                <span style="color:#777;font-size:0.95rem;">${b.date} • ${b.time}</span>
              </div>
              <div style="margin-top:6px;color:#555;">
                ${b.clientPhone ? `<span style="color:#a67c52;">${b.clientPhone}</span> • ` : ''}
                ${service?.name || 'Услуга'} (${service?.price || '?'}₽) • 
                <span style="color:#777;">Мастер: ${masterName}</span>
              </div>
            </div>
          </div>`;
      }).join("");

  updateMassActionButtons();
}

function toggleBookingSelection(id, checked) {
  if (checked) {
    selectedBookings.add(id);
  } else {
    selectedBookings.delete(id);
  }
  updateMassActionButtons();
}
window.toggleBookingSelection = toggleBookingSelection;

function updateMassActionButtons() {
  const hasSelected = selectedBookings.size > 0;
  const deleteBtn = document.getElementById("delete-selected");
  const transferBtn = document.getElementById("transfer-selected");
  if (deleteBtn) deleteBtn.disabled = !hasSelected;
  if (transferBtn) transferBtn.disabled = !hasSelected;
}

// === МАССОВОЕ УДАЛЕНИЕ ===
window.deleteSelectedBookings = async () => {
  if (!selectedBookings.size) return;
  if (!confirm(`Удалить ${selectedBookings.size} выбранных записей навсегда?`)) return;

  try {
    const promises = [...selectedBookings].map(id => deleteDoc(doc(db, "bookings", id)));
    await Promise.all(promises);
    selectedBookings.clear();
    toast(`Удалено ${promises.length} записей!`, "success");
  } catch (err) {
    toast("Ошибка при массовом удалении", "error");
    console.error(err);
  }
};

// === МАССОВЫЙ ПЕРЕНОС (заглушка с планом на будущее) ===
window.transferSelectedBookings = () => {
  if (!selectedBookings.size) return;
  alert(`Выбрано ${selectedBookings.size} записей для массового переноса.\n\nФункция в разработке — скоро добавим модалку с выбором новой даты и времени для всех сразу! 😏`);
  // TODO: здесь потом открываем модалку с newDate и newTime
  // и применяем updateDoc для каждой записи
};

// === КАЛЕНДАРЬ И ОСТАЛЬНОЕ (без изменений, но оставил для полноты) ===
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

  const snap = await getDocs(collection(db, "blocked"));
  const allBlocked = snap.docs.map(d => d.data()).filter(b => 
    b.masterId === masterId && b.date >= start && b.date <= end
  );

  const blocked = {};
  allBlocked.forEach(data => {
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

// === МОДАЛКА ДНЯ ===
window.openDayModal = async (date) => {
  const masterId = currentMaster?.id || null;

  const bookingsSnap = isSuperAdmin
    ? await getDocs(query(collection(db, "bookings"), where("date", "==", date)))
    : await getDocs(query(collection(db, "bookings"), where("date", "==", date), where("masterId", "==", masterId)));

  const bookings = bookingsSnap.docs.map(d => d.data());

  const blockedSnap = await getDocs(query(collection(db, "blocked"), where("date", "==", date), where("masterId", "==", masterId)));
  const blockedTimes = blockedSnap.docs.filter(d => !d.data().fullDay).map(d => d.data().time);
  const fullDayBlocked = blockedSnap.docs.some(d => d.data().fullDay);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;";

  const closeThisModal = () => overlay.remove();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeThisModal();
  });

  overlay.innerHTML = `
    <div style="background:white;padding:40px;border-radius:32px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-hover);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="color:var(--accent);margin:0;">${date.replace(/-/g, '.')}</h2>
        <span onclick="this.closest('[style*=\'fixed\']')?.remove()" 
              style="font-size:2.5rem;cursor:pointer;color:#aaa;">×</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px;">
        ${timeSlots.map(time => {
          const booked = bookings.some(b => b.time === time);
          const blocked = blockedTimes.includes(time);
          return `
            <div style="padding:18px;border-radius:20px;text-align:center;font-weight:700;
                        background:${booked?'#ff9800':blocked?'#ff5252':'#f0e6e0'};
                        color:${booked||blocked?'white':'#333'};
                        cursor:${booked?'not-allowed':'pointer'};"
                 ${!booked ? `onclick="toggleTimeBlock('${date}','${time}',this)"` : ''}">
              ${time}${blocked?'<br><small>Заблокировано</small>':''}
            </div>`;
        }).join("")}
      </div>

      <button onclick="toggleFullDay('${date}',${fullDayBlocked})" 
              style="width:100%;padding:18px;border:none;border-radius:24px;font-size:1.2rem;color:white;
                     background:${fullDayBlocked?'#ff9800':'#ff5252'};cursor:pointer;margin-bottom:12px;">
        ${fullDayBlocked ? 'Разблокировать весь день' : 'Заблокировать весь день'}
      </button>

      <button onclick="this.closest('[style*=\'fixed\']')?.remove()" 
              style="width:100%;padding:16px;background:#666;color:white;border:none;border-radius:20px;">
        Закрыть
      </button>
    </div>`;

  document.body.appendChild(overlay);

  const escHandler = (e) => {
    if (e.key === "Escape") {
      closeThisModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
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
    el.innerHTML = time + " <small>Заблокировано</small>";
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

// === МОДАЛКИ УСЛУГ, МАСТЕРОВ, ЗАПИСИ (оставил без изменений) ===
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

window.openMasterModal = async (id = null) => {
  window.currentEditMasterId = id;
  
  const modal = document.getElementById("master-modal");
  if (!modal) return;

  document.getElementById("master-name").value = "";
  document.getElementById("master-email").value = "";
  document.getElementById("master-photo").value = "";

  if (id) {
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

window.saveMaster = async () => {
  const name = document.getElementById("master-name").value.trim();
  const email = document.getElementById("master-email").value.trim();
  const photo = document.getElementById("master-photo").value.trim();

  if (!name) return alert("Имя обязательно!");

  const data = { name, email: email || null, photo: photo || null, active: true };

  try {
    if (window.currentEditMasterId) {
      await updateDoc(doc(db, "masters", window.currentEditMasterId), data);
    } else {
      await addDoc(collection(db, "masters"), data);
    }
    closeModal("master-modal");
  } catch (err) {
    alert("Ошибка сохранения мастера");
    console.error(err);
  }
};

window.toggleMasterActive = async (id, active) => {
  try {
    await updateDoc(doc(db, "masters", id), { active });
    toast(`Мастер ${active ? 'включён' : 'выключен'}`, "success");
  } catch (err) {
    toast("Ошибка изменения статуса", "error");
    console.error(err);
  }
};

let currentBookingId = null;

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

window.transferBooking = async () => {
  if (!currentBookingId) return;

  const newDate = document.getElementById("new-booking-date").value;
  const newTime = document.getElementById("new-booking-time").value;

  if (!newDate || !newTime) {
    toast("Выберите новую дату и время!", "error");
    return;
  }

  if (confirm(`Перенести запись на ${newDate} в ${newTime}?`)) {
    try {
      await updateDoc(doc(db, "bookings", currentBookingId), { date: newDate, time: newTime });
      toast("Запись успешно перенесена!", "success");
      closeModal("booking-modal");
    } catch (err) {
      toast("Ошибка переноса", "error");
      console.error(err);
    }
  }
};

window.cancelBooking = async () => {
  if (!currentBookingId) return;

  if (confirm("Точно отменить запись? Клиент получит уведомление.")) {
    try {
      await deleteDoc(doc(db, "bookings", currentBookingId));
      toast("Запись отменена!", "success");
      closeModal("booking-modal");
    } catch (err) {
      toast("Ошибка отмены", "error");
      console.error(err);
    }
  }
};

// === ЗАПУСК ===
auth.onAuthStateChanged(() => {
  isSuperAdmin = window.isSuperAdmin === true || localStorage.getItem("superAdminAuth") === "true";

  const masterAuth = localStorage.getItem("masterAuth");
  if (masterAuth) currentMaster = JSON.parse(masterAuth);

  if (!isSuperAdmin && !currentMaster) {
    location.href = "super-login.html";
    return;
  }

  setupInterface();

  onSnapshot(collection(db, "services"), s => {
    window.servicesList = s.docs.map(d => ({id: d.id, ...d.data()}));
    if (isSuperAdmin) renderServices();
  });

  onSnapshot(collection(db, "masters"), s => {
    window.mastersList = s.docs.map(d => ({id: d.id, ...d.data()}));
    populateMasterFilter(); // Заполняем фильтр мастеров
    if (isSuperAdmin) renderMasters(s.docs);
  });

  onSnapshot(collection(db, "bookings"), s => {
    bookingsData = s.docs.map(d => ({id: d.id, ...d.data()}));
    renderBookings();
  });

  renderCalendar();

  console.log("%cАДМИНКА 2026 — ФИЛЬТРЫ, ЧЕКБОКСЫ И МАССОВЫЕ ДЕЙСТВИЯ НАХУЙ! ТЫ КОРОЛЬ, ГОСПОДИН!", "color:gold;background:black;font-size:36px;padding:20px");
});