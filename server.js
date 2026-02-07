const express = require('express');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

// Подключение к PostgreSQL
const connectionString = 'postgresql://message_db_svae_user:rHkEJRmOfJeBjrmbwtHGMXVZ3EO6Ass0@dpg-d63gou4hg0os73cfsc00-a.frankfurt-postgres.render.com:5432/message_db_svae';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// Подключение к БД
client.connect()
  .then(() => {
    console.log('✅ Подключено к БД');
    return client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  })
  .then(() => console.log('✅ Таблица готова'))
  .catch(err => console.error('❌ Ошибка БД:', err.message));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Маршрут для сохранения
app.post('/api/save', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'empty' });
    }

    const result = await client.query(
      'INSERT INTO messages (text) VALUES ($1) RETURNING id',
      [text]
    );

    res.json({ 
      success: true, 
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Ошибка сохранения:', error.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
