import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'whatsapp-web.js';
import cors from 'cors';
import qrcode from 'qrcode';

const app = express();
const server = createServer(app);

// Настройка CORS для работы с фронтендом
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'https://2wix.ru',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://2wix.ru',
    credentials: true
}));

app.use(express.json());

// Хранилище чатов
let chats: any[] = [];

// Проверка работоспособности сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Получение списка чатов
app.get('/chats', async (req, res) => {
    try {
        if (!client?.pupPage) {
            return res.status(400).json({ error: 'WhatsApp не подключен' });
        }
        const allChats = await client.getChats();
        chats = allChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            timestamp: chat.timestamp,
            unreadCount: chat.unreadCount,
            lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp
            } : null
        }));
        res.json(chats);
    } catch (error) {
        console.error('Ошибка при получении чатов:', error);
        res.status(500).json({ error: 'Ошибка при получении чатов' });
    }
});

// Отправка сообщения
app.post('/send-message', async (req, res) => {
    try {
        const { chatId, message } = req.body;
        if (!chatId || !message) {
            return res.status(400).json({ error: 'Необходимо указать chatId и message' });
        }
        
        const result = await client.sendMessage(chatId, message);
        res.json({ success: true, messageId: result.id._serialized });
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        res.status(500).json({ error: 'Ошибка при отправке сообщения' });
    }
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
            '--single-process',
            '--disable-gpu'
        ],
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
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
    
    // Обновляем список чатов при получении нового сообщения
    try {
        const allChats = await client.getChats();
        chats = allChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            timestamp: chat.timestamp,
            unreadCount: chat.unreadCount,
            lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp
            } : null
        }));
        io.emit('chats-updated', chats);
    } catch (error) {
        console.error('Ошибка при обновлении чатов:', error);
    }

    io.emit('whatsapp-message', {
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        sender: message.from
    });
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

// Обработка завершения работы
async function shutdown() {
    console.log('Завершение работы сервера...');
    try {
        if (client?.pupPage) {
            await client.destroy();
        }
        server.close();
        process.exit(0);
    } catch (error) {
        console.error('Ошибка при завершении работы:', error);
        process.exit(1);
    }
}

// Обработка сигналов завершения
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Инициализация WhatsApp клиента
let initializationPromise = client.initialize().catch(err => {
    console.error('Ошибка инициализации WhatsApp клиента:', err);
});

// Запуск сервера
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
