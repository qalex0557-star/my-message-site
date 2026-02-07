const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Создаем и подключаем базу данных
const db = new sqlite3.Database('./messages.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('✅ Подключен к базе данных SQLite');
        initDatabase();
    }
});

// Инициализация базы данных (создание таблицы)
function initDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT
        )
    `;
    
    db.run(createTableSQL, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы:', err.message);
        } else {
            console.log('✅ Таблица messages создана/уже существует');
        }
    });
}

// 📤 API: Сохранить новое сообщение
app.post('/api/messages', (req, res) => {
    try {
        const { message } = req.body;
        
        // Проверка сообщения
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'Сообщение не может быть пустым' 
            });
        }
        
        const content = message.trim();
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        
        // SQL запрос для вставки
        const sql = `INSERT INTO messages (content, ip_address, user_agent) VALUES (?, ?, ?)`;
        
        db.run(sql, [content, ip, userAgent], function(err) {
            if (err) {
                console.error('❌ Ошибка сохранения в БД:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Ошибка сохранения в базу данных' 
                });
            }
            
            console.log(`💾 Сообщение сохранено в БД. ID: ${this.lastID}`);
            
            res.json({
                success: true,
                message: 'Сообщение сохранено в базе данных',
                data: {
                    id: this.lastID,
                    length: content.length,
                    created: new Date().toISOString()
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Ошибка сервера:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// 📥 API: Получить все сообщения
app.get('/api/messages', (req, res) => {
    const sql = `SELECT * FROM messages ORDER BY created_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка чтения из БД:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Ошибка чтения из базы данных' 
            });
        }
        
        console.log(`📊 Загружено ${rows.length} сообщений из БД`);
        
        // Форматируем данные для клиента
        const formattedMessages = rows.map(row => ({
            id: row.id,
            content: row.content,
            created_at: row.created_at,
            length: row.content.length,
            ip: row.ip_address,
            browser: row.user_agent ? row.user_agent.substring(0, 50) + '...' : 'Unknown'
        }));
        
        res.json({
            success: true,
            count: formattedMessages.length,
            messages: formattedMessages
        });
    });
});

// 📊 API: Получить статистику
app.get('/api/stats', (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM messages',
        'SELECT COUNT(*) as today FROM messages WHERE date(created_at) = date("now")',
        'SELECT MAX(created_at) as last_message FROM messages',
        'SELECT AVG(LENGTH(content)) as avg_length FROM messages'
    ];
    
    let stats = {};
    let completed = 0;
    
    queries.forEach((query, index) => {
        db.get(query, [], (err, row) => {
            if (!err) {
                Object.assign(stats, row);
            }
            completed++;
            
            if (completed === queries.length) {
                // Получаем размер файла базы данных
                const fs = require('fs');
                const dbSize = fs.existsSync('./messages.db') 
                    ? fs.statSync('./messages.db').size 
                    : 0;
                
                res.json({
                    success: true,
                    stats: {
                        total_messages: stats.total || 0,
                        today_messages: stats.today || 0,
                        last_message: stats.last_message || 'Нет сообщений',
                        avg_message_length: Math.round(stats.avg_length || 0),
                        database_size: formatBytes(dbSize),
                        database_file: './messages.db'
                    }
                });
            }
        });
    });
});

// 🗑️ API: Удалить сообщение по ID
app.delete('/api/messages/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Неверный ID сообщения' 
        });
    }
    
    const sql = `DELETE FROM messages WHERE id = ?`;
    
    db.run(sql, [id], function(err) {
        if (err) {
            console.error('❌ Ошибка удаления:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Ошибка удаления из базы данных' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Сообщение не найдено' 
            });
        }
        
        console.log(`🗑️ Удалено сообщение с ID: ${id}`);
        
        res.json({
            success: true,
            message: `Сообщение ${id} успешно удалено`,
            deleted: this.changes
        });
    });
});

// 🗑️ API: Удалить все сообщения
app.delete('/api/messages', (req, res) => {
    if (req.query.confirm !== 'true') {
        return res.status(400).json({ 
            success: false, 
            error: 'Требуется подтверждение',
            message: 'Добавьте ?confirm=true к запросу'
        });
    }
    
    db.run('DELETE FROM messages', function(err) {
        if (err) {
            console.error('❌ Ошибка очистки БД:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Ошибка очистки базы данных' 
            });
        }
        
        console.log(`🗑️ Очищена база данных. Удалено: ${this.changes} сообщений`);
        
        // Сбрасываем автоинкремент
        db.run('DELETE FROM sqlite_sequence WHERE name="messages"');
        
        res.json({
            success: true,
            message: 'База данных очищена',
            deleted: this.changes
        });
    });
});

// 🩺 API: Проверка здоровья сервера
app.get('/api/health', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
        const health = {
            status: 'online',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: err ? 'error' : 'connected',
            total_messages: row ? row.count : 0
        };
        
        res.json(health);
    });
});

// 🏠 Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🚀 Запуск сервера
app.listen(PORT, () => {
    console.log(`
    🚀 Сервер запущен на порту ${PORT}
    🗄️  База данных: messages.db
    📡  API доступен по:
        POST /api/messages   - Отправить сообщение
        GET  /api/messages   - Получить все сообщения
        GET  /api/stats      - Статистика
        GET  /api/health     - Проверка сервера
        DELETE /api/messages/:id - Удалить сообщение
    `);
});

// Вспомогательная функция для форматирования размера файла
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
