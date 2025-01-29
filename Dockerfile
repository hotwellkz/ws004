FROM node:18-slim

# Установка зависимостей для Chromium
RUN apt-get update \
    && apt-get install -y chromium \
    && rm -rf /var/lib/apt/lists/*

# Установка рабочей директории
WORKDIR /app

# Копирование файлов проекта
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Установка зависимостей
RUN npm install

# Указание пути к Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Открытие порта
EXPOSE 10000

# Запуск приложения
CMD ["npm", "start"]
