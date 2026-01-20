// calendar.js — КАЛЕНДАРЬ + БЛОКИРОВКА НЕДЕЛЯМИ/МЕСЯЦАМИ (Lucifer Coventry 2026)
import {
  getDocs, query, collection, deleteDoc, addDoc, doc, writeBatch, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db, currentMaster, isSuperAdmin, adminToast, closeAllModals } from "./admin.js"; // ← берём из admin.js

const timeSlots = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"];
let calendarDate = new Date();
let currentBlockMode = null; // null | 'week' | 'month'
let blockPreviewEl = null;

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function calculateEndDate(startStr, mode) {
  const start = new Date(startStr + 'T00:00:00');
  let end = new Date(start);
  if (mode === 'week') end.setDate(start.getDate() + 6);
  else if (mode === 'month') end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return formatDateISO(end);
}

function highlightRange(startStr, endStr) {
  clearHighlight();
  let current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T23:59:59');
  while (current <= end) {
    const cell = document.querySelector(`[data-date="${formatDateISO(current)}"]`);
    if (cell) cell.classList.add('highlight-block-range');
    current.setDate(current.getDate() + 1);
  }
}

function clearHighlight() {
  document.querySelectorAll('.highlight-block-range').forEach(el => el.classList.remove('highlight-block-range'));
}

function updatePreview(text) {
  if (blockPreviewEl) blockPreviewEl.textContent = text || '—';
}

function initBlockControls() {
  blockPreviewEl = document.getElementById('block-preview');
  const cancelBtn = document.getElementById('block-mode-cancel');

  const setMode = (mode) => {
    currentBlockMode = currentBlockMode === mode ? null : mode;
    document.querySelectorAll('.block-controls .btn:not(.btn-danger)').forEach(b => b.classList.remove('active'));
    if (currentBlockMode) {
      document.getElementById(`block-mode-${mode}`).classList.add('active');
      cancelBtn.style.display = 'inline-block';
      updatePreview('(наведи на день, сука)');
    } else {
      cancelBtn.style.display = 'none';
      updatePreview('');
      clearHighlight();
    }
    renderCalendar();
  };

  ['week','month'].forEach(m => {
    document.getElementById(`block-mode-${m}`)?.addEventListener('click', () => setMode(m));
  });

  cancelBtn?.addEventListener('click', () => setMode(null));
}

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
  for (let i = 0; i < offset; i++) html += `<div style="visibility:hidden;"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const isPast = new Date(dateStr) < new Date().setHours(0,0,0,0);
    const isFullBlocked = blocked[dateStr] === "full";
    const cursor = isPast ? 'not-allowed' : (currentBlockMode ? 'crosshair' : 'pointer');

    html += `
      <div data-date="${dateStr}" style="padding:16px;border-radius:20px;text-align:center;font-weight:600;
                 background:${isFullBlocked ? '#ff5252' : isToday ? 'var(--accent)' : '#fff9f5'};
                 color:${isFullBlocked || isToday ? 'white' : 'inherit'};
                 cursor:${cursor}; transition:0.2s;"
           ${!isPast ? `onclick="handleBlockClick('${dateStr}')"` : ''}>
        ${day}${isFullBlocked ? '<br><small>Заблокировано</small>' : ''}
      </div>`;
  }

  const calendarEl = document.getElementById("block-calendar");
  if (calendarEl) {
    calendarEl.innerHTML = html;

    calendarEl.querySelectorAll('[data-date]').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        if (!currentBlockMode || new Date(cell.dataset.date) < new Date().setHours(0,0,0,0)) return;
        const dateStr = cell.dataset.date;
        const end = calculateEndDate(dateStr, currentBlockMode);
        highlightRange(dateStr, end);
        updatePreview(`до ${end.split('-').reverse().join('.')}`);
      });

      cell.addEventListener('mouseleave', () => {
        if (!currentBlockMode) return;
        clearHighlight();
        updatePreview('(наведи на день)');
      });
    });
  }
}

window.handleBlockClick = async (dateStr) => {
  if (!currentBlockMode) return openDayModal(dateStr);

  const endDate = calculateEndDate(dateStr, currentBlockMode);
  const modeName = currentBlockMode === 'week' ? 'неделю' : 'месяц';

  if (!confirm(`Заблокировать ${modeName} с ${dateStr.split('-').reverse().join('.')} по ${endDate.split('-').reverse().join('.')}?\nЭто закроет все дни.`)) return;

  try {
    const batch = writeBatch(db);
    let current = new Date(dateStr);
    const end = new Date(endDate);
    let count = 0;

    while (current <= end) {
      const dStr = formatDateISO(current);
      const ref = doc(db, "blocked", `${dStr}_full`);
      batch.set(ref, {
        date: dStr,
        fullDay: true,
        masterId: currentMaster?.id || null,
        createdBy: currentMaster ? "master" : "admin",
        createdAt: serverTimestamp()
      });
      count++;
      current.setDate(current.getDate() + 1);
    }

    await batch.commit();
    adminToast(`Заблокировано ${count} дней — пиздец удобно!`, "success");

    currentBlockMode = null;
    document.querySelectorAll('.block-controls .btn').forEach(b => b.classList.remove('active'));
    document.getElementById('block-mode-cancel').style.display = 'none';
    clearHighlight();
    updatePreview('');
    renderCalendar();
  } catch (err) {
    console.error(err);
    adminToast("Ошибка блокировки диапазона", "error");
  }
};

window.openDayModal = async (date) => {
  closeAllModals();

  const masterId = currentMaster?.id || null;

  const bookingsSnap = isSuperAdmin
    ? await getDocs(query(collection(db, "bookings"), where("date", "==", date)))
    : await getDocs(query(collection(db, "bookings"), where("date", "==", date), where("masterId", "==", masterId)));

  const bookings = bookingsSnap.docs.map(d => d.data());

  const blockedSnap = await getDocs(query(collection(db, "blocked"), where("date", "==", date), where("masterId", "==", masterId)));
  const blockedTimes = blockedSnap.docs.filter(d => !d.data().fullDay).map(d => d.data().time);
  const fullDayBlocked = blockedSnap.docs.some(d => d.data().fullDay);

  const overlay = document.createElement("div");
  overlay.className = 'modal show';
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:40px;opacity:1;";

  overlay.innerHTML = `
    <div class="modal-content">
      <span class="close">×</span>
      <h2 style="color:var(--accent);margin:0 0 20px 0;">${date.replace(/-/g, '.')}</h2>

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
              ${time}${blocked?'<br><small>Заблокировано</small>':''}
            </div>`;
        }).join("")}
      </div>

      <button id="toggle-full-day-btn" 
              style="width:100%;padding:18px;border:none;border-radius:24px;font-size:1.2rem;color:white;
                     background:${fullDayBlocked?'#ff9800':'#ff5252'};cursor:pointer;margin-bottom:12px;">
        ${fullDayBlocked ? 'Разблокировать весь день' : 'Заблокировать весь день'}
      </button>

      <button class="close-btn" style="width:100%;padding:16px;background:#666;color:white;border:none;border-radius:20px;">
        Закрыть
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  overlay.querySelector('.close').onclick = closeAllModals;
  overlay.querySelector('.close-btn').onclick = closeAllModals;
  overlay.onclick = (e) => { if (e.target === overlay) closeAllModals(); };
  overlay.querySelector('#toggle-full-day-btn').onclick = () => toggleFullDay(date, fullDayBlocked);
};

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

window.toggleFullDay = async (date, currentlyBlocked) => {
  const masterId = currentMaster?.id || null;
  if (currentlyBlocked) {
    const q = query(collection(db, "blocked"), where("date","==",date), where("fullDay","==",true), where("masterId","==",masterId));
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(d.ref);
    adminToast('День разблокирован, теперь все могут записаться, суки!', 'success');
  } else {
    await addDoc(collection(db, "blocked"), { date, fullDay:true, masterId, createdBy: currentMaster?"master":"admin" });
    adminToast('День заблокирован — никто не запишется, отдыхай, король!', 'success');
  }

  setTimeout(() => {
    closeAllModals();
    renderCalendar();
  }, 1200);
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

// === ЗАПУСК КАЛЕНДАРЯ ===
renderCalendar();
initBlockControls();
console.log("%cКАЛЕНДАРЬ ЗАПУЩЕН ОТДЕЛЬНО — ПИЗДЕЦ КАК УДОБНО!", "color:lime;background:black;font-size:24px;padding:10px");