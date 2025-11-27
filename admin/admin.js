// admin.js — ФИНАЛЬНАЯ ВЕРСИЯ С НОРМАЛЬНОЙ БЛОКИРОВКОЙ ДНЯ (25.11.2025)
import { db, auth } from "./firebase-config.js";
import {
  collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc,
  query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { setCurrentServiceId, openServiceModal, closeServiceModal, saveService } from "./modal.js";

let currentDate = null;
let allBookings = [];

// ====================== АДМИН ВЫХОД ======================
window.logoutAdmin = async () => {
  if (!confirm("Точно выйти из админки?")) return;
  try {
    await signOut(auth);
    console.log("%cАдмин вышел — пока, долбоёб!", "color:red;font-size:18px;font-weight:bold");
    alert("Вы успешно вышли");
    window.location.href = "/calendar.html";
  } catch (e) {
    alert("Ошибка выхода: " + e.message);
  }
};

const calendar = flatpickr("#admin-calendar", {
  inline: true,
  onChange: (dates, dateStr) => {
    currentDate = dateStr;
    loadTimeSlots(dateStr);
  }
});

// ====================== ЗАГРУЗКА СЛОТОВ ======================
async function loadTimeSlots(dateStr) {
  const container = document.getElementById("time-slots");
  container.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#999'>Загрузка...</p>";

  // Получаем ВСЕ документы за день (включая fullDay)
  const snap = await getDocs(query(collection(db, "blocked"), where("date", "==", dateStr)));
  const blockedDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Проверяем, есть ли полная блокировка дня
  const fullDayBlock = blockedDocs.find(b => b.fullDay === true);

  if (fullDayBlock) {
    container.innerHTML = `
      <div style="grid-column:1/-1;background:#ffebee;border-radius:20px;padding:40px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:16px;">🚫</div>
        <div style="font-size:1.5rem;font-weight:700;color:#c62828;">ДЕНЬ ПОЛНОСТЬЮ ЗАКРЫТ</div>
        <button class="btn-block-day unblock" onclick="unblockWholeDay()" style="margin-top:20px;">
          Разблокировать день
        </button>
      </div>
    `;
    container.classList.add("blocked-full");
    return;
  }

  // Обычные блокировки по времени
  const blockedTimes = blockedDocs
    .filter(b => b.blocked === true && b.time !== "00:00")
    .map(b => b.time);

  let html = "";
  for (let h = 10; h <= 20; h++) {
    ["00", "30"].forEach(m => {
      if (h === 20 && m === "30") return;
      const time = `${String(h).padStart(2, '0')}:${m}`;
      const blocked = blockedTimes.includes(time);
      html += `<div class="time-slot ${blocked ? 'blocked' : ''}" onclick="toggleBlock('${dateStr}', '${time}')">${time}</div>`;
    });
  }

  container.innerHTML = html + `
    <div style="grid-column:1/-1;margin-top:20px;text-align:center;">
      <button class="btn-block-day" onclick="blockWholeDay()">Заблокировать весь день</button>
    </div>
  `;

  container.classList.remove("blocked-full");
}

// ====================== БЛОКИРОВКА СЛОТА ======================
window.toggleBlock = async (date, time) => {
  const q = query(collection(db, "blocked"),
    where("date", "==", date),
    where("time", "==", time),
    where("blocked", "==", true)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    await deleteDoc(snap.docs[0].ref);
  } else {
    await addDoc(collection(db, "blocked"), {
      date,
      time,
      blocked: true,
      clientName: "Админ",
      clientPhone: "блокировка"
    });
  }
  loadTimeSlots(date);
};

// ====================== БЛОКИРОВКА ВСЕГО ДНЯ ======================
window.blockWholeDay = async () => {
  if (!currentDate) return;
  if (!confirm("Заблокировать ВЕСЬ день? Клиенты не смогут записаться!")) return;

  await addDoc(collection(db, "blocked"), {
    date: currentDate,
    time: "00:00",
    fullDay: true,
    blocked: true,
    clientName: "АДМИН",
    clientPhone: "ДЕНЬ ЗАКРЫТ"
  });

  loadTimeSlots(currentDate);
};

window.unblockWholeDay = async () => {
  if (!currentDate || !confirm("Разблокировать весь день?")) return;

  const q = query(
    collection(db, "blocked"),
    where("date", "==", currentDate),
    where("fullDay", "==", true)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }

  loadTimeSlots(currentDate);
};

// ====================== РЕНДЕР УСЛУГ И ЗАПИСЕЙ ======================
function renderServices(services) {
  const list = document.getElementById("services-list");
  if (!services.length) {
    list.innerHTML = "<p class='empty'>Нет услуг</p>";
    return;
  }
  list.innerHTML = services.map(s => `
    <div class="service-item">
      <div><strong>${s.name}</strong> — ${s.price}₽ (${s.duration} мин)</div>
      <div>
        <button onclick="editService('${s.id}', '${s.name}', ${s.price}, ${s.duration})">Редактировать</button>
        <button class="delete-btn" onclick="deleteService('${s.id}')">Удалить</button>
      </div>
    </div>
  `).join("");
}

function renderBookings(bookings) {
  allBookings = bookings;
  const list = document.getElementById("bookings-list");
  document.getElementById("count").textContent = bookings.length;

  if (!bookings.length) {
    list.innerHTML = "<p class='empty'>Нет записей</p>";
    return;
  }

  list.innerHTML = bookings.map(b => `
    <div class="booking-item">
      <div>
        <strong>${b.clientName}</strong> • ${b.clientPhone}<br>
        ${b.date} ${b.time} • ${b.serviceName || "Без услуги"}
      </div>
      <div>
        <button title="Редактировать" onclick="editBooking('${b.id}')">Редактировать</button>
        <button class="delete-btn" onclick="deleteBooking('${b.id}')">Удалить</button>
      </div>
    </div>
  `).join("");
}

// ====================== ФИЛЬТРЫ ======================
window.filterBookings = () => {
  let filtered = allBookings;
  const search = document.getElementById("search-input").value.toLowerCase();
  const date = document.getElementById("filter-date").value;
  const service = document.getElementById("filter-service").value;

  if (search) filtered = filtered.filter(b => 
    b.clientName.toLowerCase().includes(search) || 
    b.clientPhone.includes(search)
  );
  if (date) filtered = filtered.filter(b => b.date === date);
  if (service) filtered = filtered.filter(b => b.serviceId === service);

  renderBookings(filtered);
};

window.clearFilters = () => {
  document.getElementById("search-input").value = "";
  document.getElementById("filter-date").value = "";
  document.getElementById("filter-service").value = "";
  renderBookings(allBookings);
};

// ====================== РЕДАКТИРОВАНИЕ ======================
window.editBooking = async (id) => {
  const b = allBookings.find(x => x.id === id);
  const name = prompt("Имя", b.clientName);
  if (name === null) return;
  const phone = prompt("Телефон", b.clientPhone);
  if (phone === null) return;
  const service = prompt("Услуга", b.serviceName || "");

  await updateDoc(doc(db, "blocked", id), {
    clientName: name || b.clientName,
    clientPhone: phone || b.clientPhone,
    serviceName: service || null
  });
};

window.deleteBooking = id => confirm("Удалить запись?") && deleteDoc(doc(db, "blocked", id));

window.editService = (id, name, price, duration) => {
  setCurrentServiceId(id);
  document.getElementById("modal-title").textContent = "Редактировать услугу";
  document.getElementById("service-name").value = name;
  document.getElementById("service-price").value = price;
  document.getElementById("service-duration").value = duration;
  openServiceModal();
};

window.deleteService = id => confirm("Удалить услугу?") && deleteDoc(doc(db, "services", id));

// ====================== МОДАЛКИ УСЛУГ ======================
window.openServiceModal = openServiceModal;
window.closeServiceModal = closeServiceModal;
window.saveService = () => saveService(db, () => {
  closeServiceModal();
  document.getElementById("modal-title").textContent = "Добавить услугу";
  document.getElementById("service-name").value = "";
  document.getElementById("service-price").value = "";
  document.getElementById("service-duration").value = "60";
  setCurrentServiceId(null);
});

// ====================== СНАПШОТЫ ======================
onSnapshot(collection(db, "services"), snap => {
  const services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderServices(services);
  const select = document.getElementById("filter-service");
  select.innerHTML = `<option value="">Все услуги</option>` + 
    services.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
});

onSnapshot(collection(db, "bookings"), snap => {
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  allBookings = bookings;
  renderBookings(bookings.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
});

// Автозагрузка сегодня при открытии
if (window.location.search.includes("date=")) {
  const urlDate = new URLSearchParams(window.location.search).get("date");
  calendar.setDate(urlDate, true);
}