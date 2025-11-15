# Fire Monitoring API

Бэкенд для системы мониторинга пожаров с SQLite базой данных.

## Запуск

```bash
npm install
node server.js
```

Сервер запустится на порту 3001.

## API Endpoints

### GET /
Информация об API и доступных эндпоинтах

### GET /api/fires
Получить все пожары (с опциональной фильтрацией по статусу)

**Query параметры:**
- `status` (optional): `active`, `contained`, или `extinguished`

**Пример:**
```bash
curl http://localhost:3001/api/fires
curl http://localhost:3001/api/fires?status=active
```

**Ответ:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "latitude": 34.6857,
      "longitude": 33.0437,
      "intensity": "high",
      "description": "Large forest fire near Troodos Mountains",
      "reported_at": "2025-11-15 18:41:29",
      "status": "active",
      "reporter_name": null,
      "reporter_contact": null
    }
  ]
}
```

### GET /api/fires/:id
Получить конкретный пожар по ID

**Пример:**
```bash
curl http://localhost:3001/api/fires/1
```

### POST /api/fires
Создать репорт о новом пожаре

**Тело запроса:**
```json
{
  "latitude": 35.0,
  "longitude": 33.5,
  "intensity": "high",
  "description": "Fire description",
  "reporter_name": "John Doe",
  "reporter_contact": "john@example.com"
}
```

**Поля:**
- `latitude` (required): широта (-90 до 90)
- `longitude` (required): долгота (-180 до 180)
- `intensity` (optional): `low`, `medium`, или `high` (default: `medium`)
- `description` (optional): описание пожара
- `reporter_name` (optional): имя репортера
- `reporter_contact` (optional): контакт репортера

**Пример:**
```bash
curl -X POST http://localhost:3001/api/fires \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 35.0,
    "longitude": 33.5,
    "intensity": "high",
    "description": "Test fire report",
    "reporter_name": "Test User"
  }'
```

### PATCH /api/fires/:id
Обновить статус пожара

**Тело запроса:**
```json
{
  "status": "contained"
}
```

**Допустимые статусы:**
- `active` - активный пожар
- `contained` - локализован
- `extinguished` - потушен

**Пример:**
```bash
curl -X PATCH http://localhost:3001/api/fires/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "contained"}'
```

### DELETE /api/fires/:id
Удалить пожар из базы

**Пример:**
```bash
curl -X DELETE http://localhost:3001/api/fires/1
```

## База данных

Используется SQLite с автоматической инициализацией схемы при первом запуске.

**Структура таблицы fires:**
- `id` - PRIMARY KEY AUTOINCREMENT
- `latitude` - REAL (широта)
- `longitude` - REAL (долгота)
- `intensity` - TEXT ('low', 'medium', 'high')
- `description` - TEXT
- `reported_at` - DATETIME (автоматически)
- `status` - TEXT ('active', 'contained', 'extinguished')
- `reporter_name` - TEXT
- `reporter_contact` - TEXT

## CORS

CORS настроен на разрешение всех источников для удобства деплоя на бесплатных сервисах.

## Деплой

Бэкенд готов к деплою на:
- Railway.app
- Render.com
- Fly.io
- Heroku

Просто установите переменную окружения `PORT` если требуется.
