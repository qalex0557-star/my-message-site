const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
// Render задает порт через переменную окружения, поэтому используем ее, иначе 3000 для локального запуска
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Разрешаем CORS (если фронтенд и бэкенд на разных доменах, но на Render они на одном, однако если есть проблемы, то это поможет)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Путь к папке с сообщениями
// На Render может быть ограничена файловая система, поэтому создаем папку в текущей директории (или в /tmp, если нет прав)
const MESSAGES_DIR = path.join(__dirname, 'messages');

// Создаем папку для сообщений, если ее нет
if (!fs.existsSync(MESSAGES_DIR)) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
}

// Сохранение сообщения
app.post('/api/messages', (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }

    const timestamp = new Date();
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`;
    const filepath = path.join(MESSAGES_DIR, filename);

    const data = `Время: ${timestamp.toLocaleString('ru-RU')}\n\n${message}\n\n---`;

    fs.writeFileSync(filepath, data, 'utf8');

    console.log(`Сообщение сохранено: ${filename}`);

    res.json({
      success: true,
      filename: filename,
      length: message.length
    });

  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Для проверки работоспособности сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
