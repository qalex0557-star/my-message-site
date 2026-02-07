const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Подключение к PostgreSQL (Render автоматически добавит DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Инициализация базы
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ База данных PostgreSQL готова');
  } catch (error) {
    console.error('❌ Ошибка базы данных:', error);
  }
}

// 📤 API: Сохранить сообщение
app.post('/api/messages', async (req, res) => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Сообщение обязательно' 
    });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO messages (message) VALUES ($1) RETURNING *',
      [message.trim()]
    );
    
    console.log(`💾 Сообщение сохранено в PostgreSQL. ID: ${result.rows[0].id}`);
    
    res.json({
      success: true,
      id: result.rows[0].id,
      length: message.length,
      timestamp: result.rows[0].created_at
    });
    
  } catch (error) {
    console.error('❌ Ошибка базы данных:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сохранения' 
    });
  }
});

// Инициализация при запуске
initDB();

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
  console.log(`🗄️  Используется PostgreSQL`);
});
