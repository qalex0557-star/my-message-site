const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Определяем путь к папке messages
// На Render.com лучше использовать путь, который разрешен для записи
const MESSAGES_DIR = path.join(__dirname, 'messages');

// Создаем папку, если ее нет
if (!fs.existsSync(MESSAGES_DIR)) {
    fs.mkdirSync(MESSAGES_DIR, { recursive: true });
    console.log(`Папка создана: ${MESSAGES_DIR}`);
} else {
    console.log(`Папка уже существует: ${MESSAGES_DIR}`);
}

app.post('/api/messages', (req, res) => {
    console.log('Получен POST запрос на /api/messages');
    
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            console.log('Сообщение пустое или не строка');
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }
        
        const timestamp = new Date();
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`;
        const filepath = path.join(MESSAGES_DIR, filename);
        
        const data = `Время: ${timestamp.toLocaleString('ru-RU')}\n\n${message}\n\n---`;
        
        fs.writeFileSync(filepath, data, 'utf8');
        
        console.log(`Сообщение сохранено в файл: ${filename}`);
        
        res.json({
            success: true,
            filename: filename,
            length: message.length
        });
        
    } catch (error) {
        console.error('Ошибка при сохранении сообщения:', error);
        res.status(500).json({ 
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// Добавим маршрут для проверки работы сервера
app.get('/api/test', (req, res) => {
    console.log('Запрос на /api/test');
    res.json({ 
        status: 'ok', 
        message: 'Сервер работает',
        port: PORT,
        messagesDir: MESSAGES_DIR
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Папка для сообщений: ${MESSAGES_DIR}`);
});
