const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const MESSAGES_DIR = path.join(__dirname, 'messages');

if (!fs.existsSync(MESSAGES_DIR)) {
    fs.mkdirSync(MESSAGES_DIR);
}

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
        
        console.log(`Сохранено сообщение: ${filename} (${message.length} символов)`);
        
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

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log(`Сообщения сохраняются в: ${MESSAGES_DIR}`);
});