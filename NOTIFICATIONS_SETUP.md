# Настройка уведомлений

## Переменные окружения

Создайте файл `.env` в папке `backend/` со следующими переменными:

### Telegram

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=@hotSpotFireAlarm
```

**Как получить Telegram Bot Token:**
1. Откройте Telegram и найдите бота [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

**Chat ID:**
- Для канала: используйте формат `@channel_username` (например, `@hotSpotFireAlarm`)
- Или используйте числовой ID канала (можно получить через бота [@userinfobot](https://t.me/userinfobot))

### WhatsApp

```env
WHATSAPP_GROUP_NAME=Your Group Name
# ИЛИ
WHATSAPP_PHONE_NUMBER=+1234567890
```

**Настройка WhatsApp:**
1. При первом запуске сервера будет сгенерирован QR-код в консоли
2. Отсканируйте QR-код с помощью WhatsApp на вашем телефоне
3. Сессия будет сохранена в папке `.wwebjs_auth/`
4. Укажите имя группы в `WHATSAPP_GROUP_NAME` или номер телефона в `WHATSAPP_PHONE_NUMBER`

**Примечание:** Для WhatsApp требуется установка Chromium (автоматически устанавливается с `whatsapp-web.js`)

## Использование

### Отправка уведомлений

1. На карте выполните долгое нажатие (500ms) в любой точке
2. Откроется модальное окно для ввода данных:
   - Введите текст уведомления
   - Добавьте координаты безопасных точек эвакуации
3. Нажмите "Send Notification"

### API Endpoints

#### POST `/api/notifications/send`

Отправляет уведомление в Telegram и/или WhatsApp.

**Тело запроса:**
```json
{
  "message": "Текст уведомления",
  "evacuationPoints": [[34.6738515, 33.0567334], [34.6528625, 32.9975162]],
  "location": [34.6857, 33.0437]
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "results": {
    "telegram": {
      "success": true,
      "messageId": 123
    },
    "whatsapp": {
      "success": true,
      "messageId": "3EB0..."
    },
    "errors": []
  }
}
```

#### GET `/api/whatsapp/status`

Получить статус WhatsApp клиента.

#### GET `/api/whatsapp/qr`

Получить QR-код для авторизации WhatsApp (если требуется).

#### POST `/api/whatsapp/initialize`

Инициализировать WhatsApp клиент.

## Установка зависимостей

```bash
cd backend
npm install
```

## Запуск

```bash
npm start
```

Сервер запустится на порту 3001 (или порту, указанному в переменной окружения `PORT`).

