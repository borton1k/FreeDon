# FreeDon Upgrader

Апгрейдер предметов с сервером.

## Стек
- Node.js + Express
- bcryptjs (хеширование паролей)
- JSON-файл как база данных (db.json)

## Локальный запуск
1. Установить Node.js 18+
2. В папке проекта: npm install
3. Запустить: npm start
4. Открыть: http://localhost:3000

## Деплой на Render
1. Залить проект на GitHub
2. Render → New → Web Service → выбрать репозиторий
3. Build Command: npm install
4. Start Command: npm start
5. Готово — Render даст ссылку