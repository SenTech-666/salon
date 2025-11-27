// src/telegram.js
const TELEGRAM_TOKEN = "8543613937:AAGAHTi7dC6XQv9eML9xnN7ju_CprS36OO4"; // ← ТВОЙ ТОКЕН ОТ @BotFather
const CHAT_ID = 6176382517; // ← ТВОЙ chat_id (от @userinfobot)

export const sendTelegramNotification = async (booking) => {
  const text = `
НОВАЯ ЗАПИСЬ! 

Клиент: ${booking.clientName}
Телефон: ${booking.clientPhone}
Услуга: ${booking.serviceName} (${booking.duration} мин)
Дата: ${booking.date}
Время: ${booking.time}

Календарь: https://твой-домен.рф
  `.trim();

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn("Telegram ошибка:", error);
    }
    // Если всё ок — ничего не делаем (тихо радуемся)
  } catch (err) {
    console.warn("Telegram не отправил (но запись сохранена):", err);
  }
};