const express = require('express');
const path = require('path');

const app = express();
// Render задает порт через переменную окружения
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Простой API для проверки
app.post('/api/messages', (req, res) => {
    console.log('📩 Получено сообщение:', req.body.message?.length || 0, 'символов');
    
    res.json({
        success: true,
        message: 'Сообщение получено!',
        length: req.body.message?.length || 0,
        timestamp: new Date().toISOString()
    });
});

// Проверка сервера
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ error: 'Страница не найдена' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
});
