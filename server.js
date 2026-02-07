const express = require('express');
const { Client } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Ваша строка подключения
const connectionString = 'postgresql://message_db_svae_user:rHkEJRmOfJeBjrmbwtHGMXVZ3EO6Ass0@dpg-d63gou4hg0os73cfsc00-a.frankfurt-postgres.render.com:5432/message_db_svae';

console.log('Запуск сервера...');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Функция для создания подключения к БД
const createConnection = () => {
  return new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
      require: true
    }
  });
};

// Глобальная переменная для хранения клиента
let dbClient = null;

// Подключение к БД
const connectToDB = async () => {
  try {
    dbClient = createConnection();
    await dbClient.connect();
    console.log('✅ Подключено к PostgreSQL');
    
    // Создаем таблицу если её нет
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица messages готова');
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    dbClient = null;
    return false;
  }
};

// Обработчик ошибок подключения
const handleDBQuery = async (query, params) => {
  if (!dbClient) {
    const connected = await connectToDB();
    if (!connected) {
      throw new Error('Нет подключения к БД');
    }
  }
  
  try {
    return await dbClient.query(query, params);
  } catch (error) {
    // Если соединение потеряно, пытаемся переподключиться
    if (error.code === 'ECONNREFUSED' || error.message.includes('connection')) {
      console.log('Переподключение к БД...');
      const connected = await connectToDB();
      if (connected) {
        return await dbClient.query(query, params);
      }
    }
    throw error;
  }
};

// Инициализация подключения при старте
connectToDB();

// Маршруты
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbClient ? 'connected' : 'disconnected'
  });
});

app.get('/api/db-check', async (req, res) => {
  try {
    const result = await handleDBQuery('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'База данных подключена',
      time: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Ошибка подключения к БД',
      details: error.message 
    });
  }
});

// Сохранение текста - СИНХРОННАЯ версия
app.post('/api/save', async (req, res) => {
  console.log('Получен запрос на сохранение');
  
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Текст не может быть пустым' });
    }

    console.log('Текст для сохранения:', text.substring(0, 50) + '...');

    // Сохраняем текст напрямую
    const result = await handleDBQuery(
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
    
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: error.message,
      code: error.code
    });
  }
});

// Получение всех сообщений
app.get('/api/messages', async (req, res) => {
  try {
    const result = await handleDBQuery(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Статистика
app.get('/api/stats', async (req, res) => {
  try {
    const result = await handleDBQuery('SELECT COUNT(*) FROM messages');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Простой HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
