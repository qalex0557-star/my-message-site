const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Получаем строку подключения из переменных окружения Render
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ОШИБКА: DATABASE_URL не установлена!');
  console.log('Убедитесь, что в Render добавлена переменная DATABASE_URL');
  process.exit(1);
}

console.log('Подключаемся к базе данных...');

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

// Простая проверка подключения
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('✅ Успешно подключено к базе данных PostgreSQL');
    console.log('Время на сервере БД:', res.rows[0].now);
  }
});

// Создание таблицы если её нет
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`)
.then(() => console.log('✅ Таблица messages готова'))
.catch(err => console.error('Ошибка создания таблицы:', err));

// Маршрут для проверки работы сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Проверка подключения к БД
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'База данных подключена',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('Ошибка проверки БД:', error);
    res.status(500).json({ 
      error: 'Ошибка подключения к БД',
      details: error.message 
    });
  }
});

// Сохранение текста
app.post('/api/save', async (req, res) => {
  console.log('Получен запрос на сохранение текста');
  
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Текст не может быть пустым' });
    }

    console.log('Сохранение текста:', text.substring(0, 50) + '...');

    const result = await pool.query(
      'INSERT INTO messages (text) VALUES ($1) RETURNING id, created_at',
      [text]
    );

    console.log('✅ Текст сохранен, ID:', result.rows[0].id);

    res.json({ 
      success: true, 
      message: 'Текст успешно сохранен!',
      id: result.rows[0].id,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error.message);
    console.error('Полная ошибка:', error);
    
    // Подробная информация об ошибке
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: error.message,
      code: error.code,
      hint: 'Проверьте подключение к базе данных и SSL настройки'
    });
  }
});

// Получение всех сообщений
app.get('/api/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Получение количества сообщений
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM messages');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Отдача статических файлов
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Откройте в браузере: http://localhost:${PORT}`);
  console.log(`📊 Проверка здоровья: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Проверка БД: http://localhost:${PORT}/api/db-check`);
});
