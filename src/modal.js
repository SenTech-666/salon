// src/modal.js
// Модуль управления модальными окнами приложения

// Получаем корневой элемент для рендеринга модальных окон
const modalRoot = document.getElementById("modal-root");

if (!modalRoot) {
  console.error("Ошибка: элемент с id 'modal-root' не найден в DOM");
}

/**
 * Отображает модальное окно с переданным содержимым
 * @param {string} content - HTML-содержимое модального окна
 */
export const showModal = (content) => {
  if (!modalRoot) return;

  // Формируем структуру модального окна
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-close" onclick="closeModal()">×</div>
        ${content}
      </div>
    </div>
  `;

  // Запускаем анимацию появления с использованием requestAnimationFrame
  requestAnimationFrame(() => {
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    const modal = modalRoot.querySelector(".modal");

    if (backdrop) backdrop.style.opacity = "1";
    if (modal) modal.style.transform = "translateY(0)";
  });
};

/**
 * Закрывает текущее модальное окно и очищает контейнер
 * Также отписывается от активных подписок реального времени (если они были)
 */
export const closeModal = () => {
  if (modalRoot) {
    modalRoot.innerHTML = "";
  }

  // Отписываемся от слушателей реального времени (Firestore snapshots и др.)
  if (window.currentUnsubscribe && typeof window.currentUnsubscribe === "function") {
    window.currentUnsubscribe();
    window.currentUnsubscribe = null;
  }
};

// Делаем функцию закрытия доступной глобально (для использования в inline-обработчиках HTML)
window.closeModal = closeModal;

// Закрытие модального окна по нажатию клавиши Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalRoot?.innerHTML) {
    closeModal();
  }
});

// Модуль готов к использованию в production-среде