FROM node:18

WORKDIR /app

# Установка Chromium и зависимостей
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# Копирование файлов проекта
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Установка зависимостей
RUN npm install

# Установка переменных окружения для Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Создаем директорию для сессии WhatsApp
RUN mkdir -p /app/.wwebjs_auth

# Открываем порт
EXPOSE 3000

# Запуск сервера
CMD ["npm", "start"]
