// src/store.js
let state = {
  currentDate: new Date(),
  bookings: [],
  blocked: [],
  services: [],
  isAdmin: false,
  clientId: null
};

const listeners = new Set();

export const store = new Proxy(state, {
  set: (target, prop, value) => {
    target[prop] = value;
    listeners.forEach(fn => fn());
    return true;
  }
});

export const subscribe = (fn) => {
  listeners.add(fn);
  fn();
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