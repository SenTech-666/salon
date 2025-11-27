// src/modal.js — ФИНАЛЬНАЯ ВЕРСИЯ (100% рабочая, без конфликтов)
const modalRoot = document.getElementById("modal-root");

if (!modalRoot) {
  console.error("ОШИБКА: #modal-root не найден в DOM!");
}

// Основная функция показа модалки
export const showModal = (content) => {
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-close" onclick="closeModal()">×</div>
        ${content}
      </div>
    </div>
  `;

  // Плавное появление
  requestAnimationFrame(() => {
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    const modal = modalRoot.querySelector(".modal");
    if (backdrop) backdrop.style.opacity = "1";
    if (modal) modal.style.transform = "translateY(0)";
  });
};

// Универсальная функция закрытия — с отпиской от реал-тайма (для админки)
export const closeModal = () => {
  if (modalRoot) {
    modalRoot.innerHTML = "";
  }

  // Если у тебя где-то есть подписка (например, админка), отписываемся
  if (window.currentUnsubscribe && typeof window.currentUnsubscribe === "function") {
    window.currentUnsubscribe();
    window.currentUnsubscribe = null;
  }
};

// Делаем доступной глобально (для onclick в HTML)
window.closeModal = closeModal;

// Опционально: закрытие по Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalRoot?.innerHTML) {
    closeModal();
  }
});