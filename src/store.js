// src/store.js
let state = {
  currentDate: new Date(),
  bookings: [],
  services: [],
  isAdmin: false,
  clientId: null
};

const listeners = new Set();

export const store = new Proxy(state, {
  set: function(target, prop, value) {
    target[prop] = value;
    listeners.forEach(function(fn) { fn(); });
    return true;
  }
});

export const subscribe = function(fn) {
  listeners.add(fn);
  fn();
  return function() { listeners.delete(fn); };
};

export const prevMonth = function() {
  const d = new Date(store.currentDate);
  d.setMonth(d.getMonth() - 1);
  const now = new Date();
  if (!store.isAdmin && (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()))) {
    if (window.toast) toast("Прошлые месяцы недоступны", "error");
    return;
  }
  store.currentDate = d;
};

export const nextMonth = function() {
  const d = new Date(store.currentDate);
  d.setMonth(d.getMonth() + 1);
  store.currentDate = d;
};