// src/utils.js
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export const formatDate = (date) => date.toISOString().split('T')[0];
export const todayISO = formatDate(new Date());

export const themes = {
  pink:   { p: "#ff6b9d", a: "#ff8fb3", s: "#4caf50", d: "#ff5252", bg: "#fff8fb", text: "#333", card: "#fff", border: "rgba(255,107,157,0.15)", shadow: "rgba(255,107,157,0.25)" },
  purple: { p: "#9c27b0", a: "#c969d7", s: "#66bb6a", d: "#e91e63", bg: "#f8f4fc", text: "#333", card: "#fff", border: "rgba(156,39,176,0.15)", shadow: "rgba(156,39,176,0.25)" },
  teal:   { p: "#00bcd4", a: "#4dd0e1", s: "#66bb6a", d: "#ff5252", bg: "#f0fffe", text: "#333", card: "#fff", border: "rgba(0,188,212,0.15)", shadow: "rgba(0,188,212,0.25)" },
  dark:   { p: "#e91e63", a: "#f06292", s: "#66bb6a", d: "#ff5252", bg: "#121212", text: "#e0e0e0", card: "#1e1e1e", border: "rgba(233,30,99,0.2)", shadow: "rgba(233,30,99,0.3)" }
};

export const applyTheme = function(name) {
  name = name || 'pink';
  const t = themes[name] || themes.pink;
  const root = document.documentElement;
  Object.keys(t).forEach(function(key) {
    root.style.setProperty('--' + key + '-color', t[key]);
  });
  localStorage.setItem('theme', name);
};

// FingerprintJS — ленивая загрузка через динамический импорт
let clientId = localStorage.getItem('clientId');
export const getClientId = function() {
  if (clientId) return Promise.resolve(clientId);
  return import('https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js')
    .then(function(FP) {
      return FP.load();
    })
    .then(function(fp) {
      return fp.get();
    })
    .then(function(result) {
      clientId = result.visitorId;
      localStorage.setItem('clientId', clientId);
      return clientId;
    })
    .catch(function() {
      clientId = 'fb_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('clientId', clientId);
      return clientId;
    });
};