// src/store.js — ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ, СУКА! 11.12.2025
import { db } from "./firebase.js";
import { collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let state = {
  currentDate: new Date(),
  bookings: [],
  blocked: [],
  services: [],
  masters: [],
  settings: { allowMasterSelect: false },
  isAdmin: false,
  clientId: null
};

const listeners = new Set();

// === ВСЕ ПОДПИСКИ ЗДЕСЬ — ОБНОВЛЯЮТ STATE И NOTIFY ===
onSnapshot(collection(db, "bookings"), snap => {
  state.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  notify();
});

onSnapshot(collection(db, "blocked"), snap => {
  state.blocked = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  notify();
});

onSnapshot(collection(db, "services"), snap => {
  state.services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  notify();
});

onSnapshot(collection(db, "masters"), snap => {
  state.masters = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false);
  notify();
});

onSnapshot(doc(db, "settings", "main"), snap => {
  state.settings = snap.exists() ? snap.data() : { allowMasterSelect: false };
  notify();
});

const notify = () => listeners.forEach(fn => fn());

export const store = new Proxy(state, {
  set: (target, prop, value) => {
    target[prop] = value;
    notify();
    return true;
  }
});

export const subscribe = (fn) => {
  listeners.add(fn);
  fn(); // сразу вызываем для инициализации
  return () => listeners.delete(fn);
};

export const prevMonth = () => {
  const d = new Date(store.currentDate);
  d.setMonth(d.getMonth() - 1);
  const now = new Date();
  if (!store.isAdmin && (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()))) {
    window.toast?.("Прошлые месяцы недоступны", "error");
    return;
  }
  store.currentDate = d;
};

export const nextMonth = () => {
  const d = new Date(store.currentDate);
  d.setMonth(d.getMonth() + 1);
  store.currentDate = d;
};
window.store = store;          // ← это выкидывает store в глобальную область
window.masters = store.masters; // бонус, чтоб было проще смотреть