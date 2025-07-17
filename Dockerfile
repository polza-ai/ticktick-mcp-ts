FROM node:18

WORKDIR /app

# Устанавливаем supergateway глобально
RUN npm install -g supergateway

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем TypeScript проект
RUN npm run build

# Создаем пользователя для безопасности
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Порт по умолчанию (может быть переопределен через ENV)
ENV SUPERGATEWAY_PORT=8002

# Expose порт
EXPOSE ${SUPERGATEWAY_PORT}

# Команда запуска через supergateway
CMD ["sh", "-c", "npx supergateway --stdio 'node dist/index.js' --port ${SUPERGATEWAY_PORT}"]
