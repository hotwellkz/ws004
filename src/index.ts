import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'whatsapp-web.js';
import cors from 'cors';
import qrcode from 'qrcode';

const app = express();
const server = createServer(app);

// Настройка CORS для работы с Netlify
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// Проверка работоспособности сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Инициализация WhatsApp клиента
const client = new Client({
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        headless: true
    }
});

// Обработка событий WhatsApp
client.on('qr', async (qr) => {
    try {
        const qrCode = await qrcode.toDataURL(qr);
        io.emit('qr', qrCode);
    } catch (err) {
        console.error('Ошибка генерации QR кода:', err);
    }
});

client.on('ready', () => {
    console.log('WhatsApp клиент готов!');
    io.emit('ready');
});

client.on('message', async (message) => {
    console.log('Получено новое сообщение:', message);
    io.emit('whatsapp-message', {
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        sender: message.from
    });
});

// Инициализация WhatsApp клиента
client.initialize().catch(err => {
    console.error('Ошибка инициализации WhatsApp клиента:', err);
});

// Обработка WebSocket соединений
io.on('connection', (socket) => {
    console.log('Клиент подключен');

    socket.on('send-message', async (data) => {
        try {
            const { to, message } = data;
            await client.sendMessage(to, message);
            console.log('Сообщение отправлено:', { to, message });
        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            socket.emit('error', 'Ошибка отправки сообщения');
        }
    });

    socket.on('disconnect', () => {
        console.log('Клиент отключен');
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
