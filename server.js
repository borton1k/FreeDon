const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// ---- Утилиты ----
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function generateTicketId() {
  let id = '';
  for (let i = 0; i < 8; i++) id += Math.floor(Math.random() * 10);
  return id;
}

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Главная — отдаём index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- API: регистрация ----
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) return res.status(400).json({ error: 'Ник: 3–16 символов, латиница, цифры, _' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });

    const db = loadDB();
    if (db.users[username]) return res.status(400).json({ error: 'Такой ник уже занят' });

    const hash = await bcrypt.hash(password, 10);
    db.users[username] = {
      hash,
      balance: 0,
      inventory: [],
      history: [],
      notifications: [],
      createdAt: Date.now()
    };
    saveDB(db);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---- API: вход ----
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    const db = loadDB();
    const user = db.users[username];
    if (!user) return res.status(400).json({ error: 'Игрок не найден' });

    const ok = await bcrypt.compare(password, user.hash);
    if (!ok) return res.status(400).json({ error: 'Неверный пароль' });

    res.json({
      ok: true,
      user: {
        username,
        balance: user.balance,
        inventory: user.inventory,
        history: user.history,
        notifications: user.notifications || [],
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---- API: получить данные пользователя ----
app.post('/api/user', (req, res) => {
  try {
    const { username, password } = req.body;
    const db = loadDB();
    const user = db.users[username];
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    // Простая проверка пароля для этого запроса
    bcrypt.compare(password || '', user.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль' });
      res.json({
        balance: user.balance,
        inventory: user.inventory,
        history: user.history,
        notifications: user.notifications || [],
        createdAt: user.createdAt
      });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---- API: получить уведомления и очистить ----
app.post('/api/notifications/consume', (req, res) => {
  try {
    const { username, password } = req.body;
    const db = loadDB();
    const user = db.users[username];
    if (!user) return res.status(404).json({ error: 'Не найден' });

    bcrypt.compare(password || '', user.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль' });
      const notes = user.notifications || [];
      user.notifications = [];
      saveDB(db);
      res.json({ notifications: notes });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ---- API: апгрейд (вся логика на сервере) ----
app.post('/api/upgrade', (req, res) => {
  try {
    const { username, password, fromItemId, toItemId, items } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Не авторизован' });

    const db = loadDB();
    const user = db.users[username];
    if (!user) return res.status(404).json({ error: 'Не найден' });

    bcrypt.compare(password, user.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль' });

      const fromItem = items.find(i => i.id === fromItemId);
      const toItem = items.find(i => i.id === toItemId);
      if (!fromItem || !toItem) return res.status(400).json({ error: 'Предмет не найден' });

      const idx = user.inventory.findIndex(i => i.id === fromItemId);
      if (idx === -1) return res.status(400).json({ error: 'У вас нет этого предмета в инвентаре' });

      let chance = (fromItem.price / toItem.price) * 100;
      if (chance > 90) chance = 90;

      const isWin = Math.random() * 100 <= chance;

      user.inventory.splice(idx, 1);
      if (isWin) {
        user.inventory.push({
          ...toItem,
          legit: true,
          source: 'upgrade',
          obtainedAt: Date.now(),
          ticketId: generateTicketId()
        });
      }

      user.history.unshift({
        id: Date.now(),
        from: fromItem.name,
        to: toItem.name,
        chance: parseFloat(chance.toFixed(2)),
        win: isWin,
        time: new Date().toLocaleTimeString().slice(0, 5)
      });
      if (user.history.length > 50) user.history = user.history.slice(0, 50);

      saveDB(db);
      res.json({
        ok: true,
        win: isWin,
        chance: parseFloat(chance.toFixed(2)),
        balance: user.balance,
        inventory: user.inventory,
        history: user.history
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---- API: покупка предмета ----
app.post('/api/buy', (req, res) => {
  try {
    const { username, password, item } = req.body;
    if (!username || !password || !item) return res.status(400).json({ error: 'Нет данных' });

    const db = loadDB();
    const user = db.users[username];
    if (!user) return res.status(404).json({ error: 'Не найден' });

    bcrypt.compare(password, user.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль' });

      if (user.balance < item.price) return res.status(400).json({ error: 'Недостаточно монет' });

      user.balance -= item.price;
      user.inventory.push({
        ...item,
        legit: true,
        source: 'shop',
        obtainedAt: Date.now(),
        ticketId: generateTicketId()
      });

      saveDB(db);
      res.json({ ok: true, balance: user.balance, inventory: user.inventory });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ---- API: админ — начислить/списать монеты ----
app.post('/api/admin/grant', (req, res) => {
  try {
    const { adminUser, adminPass, targetUser, amount, admins } = req.body;

    if (!admins.includes(adminUser)) return res.status(403).json({ error: 'Нет прав' });

    const db = loadDB();
    const admin = db.users[adminUser];
    if (!admin) return res.status(404).json({ error: 'Админ не найден' });

    bcrypt.compare(adminPass, admin.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль админа' });

      const target = db.users[targetUser];
      if (!target) return res.status(404).json({ error: `Игрок "${targetUser}" не найден` });

      const sum = Number(amount);
      if (!sum || isNaN(sum)) return res.status(400).json({ error: 'Неверная сумма' });
      if (target.balance + sum < 0) return res.status(400).json({ error: 'Баланс не может быть отрицательным' });

      target.balance += sum;
      if (sum > 0) {
        if (!target.notifications) target.notifications = [];
        target.notifications.push(`Администратор выдал вам ${sum} монет!`);
      }

      saveDB(db);
      res.json({ ok: true, text: `${targetUser}: ${sum > 0 ? 'начислено' : 'списано'} ${Math.abs(sum)} монет` });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ---- API: список игроков (для админки) ----
app.post('/api/admin/list', (req, res) => {
  try {
    const { adminUser, adminPass, admins } = req.body;
    if (!admins.includes(adminUser)) return res.status(403).json({ error: 'Нет прав' });

    const db = loadDB();
    const admin = db.users[adminUser];
    if (!admin) return res.status(404).json({ error: 'Админ не найден' });

    bcrypt.compare(adminPass, admin.hash).then(ok => {
      if (!ok) return res.status(403).json({ error: 'Неверный пароль' });
      const list = Object.keys(db.users).map(u => ({
        username: u,
        balance: db.users[u].balance || 0,
        inventoryCount: (db.users[u].inventory || []).length
      }));
      res.json({ users: list });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ---- Запуск ----
app.listen(PORT, () => {
  console.log(`FreeDon Upgrader сервер запущен на порту ${PORT}`);
});