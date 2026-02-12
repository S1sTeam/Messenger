#!/bin/bash

echo "🚀 Начинаем деплой мессенджера..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите Node.js 18+: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js установлен: $(node -v)${NC}"

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 не установлен. Устанавливаем...${NC}"
    sudo npm install -g pm2
fi

echo -e "${GREEN}✅ PM2 установлен${NC}"

# Установка зависимостей
echo -e "${YELLOW}📦 Устанавливаем зависимости...${NC}"
npm install

cd apps/server
npm install
echo -e "${GREEN}✅ Зависимости сервера установлены${NC}"

cd ../web
npm install
echo -e "${GREEN}✅ Зависимости веб-клиента установлены${NC}"

cd ../..

# Настройка базы данных
echo -e "${YELLOW}🗄️  Настраиваем базу данных...${NC}"
cd apps/server

# Проверка .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Создаем .env файл...${NC}"
    cat > .env << EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="$(openssl rand -base64 32)"
PORT=3000
NODE_ENV=production
EOF
    echo -e "${GREEN}✅ .env файл создан${NC}"
fi

npx prisma generate
npx prisma migrate deploy
echo -e "${GREEN}✅ База данных настроена${NC}"

cd ../..

# Сборка фронтенда
echo -e "${YELLOW}🔨 Собираем фронтенд...${NC}"
cd apps/web

# Запрос IP или домена
read -p "Введите IP адрес или домен вашего VPS (например: 192.168.1.1 или example.com): " SERVER_ADDRESS

if [ -z "$SERVER_ADDRESS" ]; then
    SERVER_ADDRESS="localhost"
fi

echo "VITE_API_URL=http://$SERVER_ADDRESS:3000" > .env.production

npm run build
echo -e "${GREEN}✅ Фронтенд собран${NC}"

cd ../..

# Запуск сервера через PM2
echo -e "${YELLOW}🚀 Запускаем сервер...${NC}"
pm2 delete messenger-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✅ Сервер запущен${NC}"

# Настройка автозапуска
pm2 startup | tail -n 1 | bash

echo ""
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo ""
echo "📝 Полезные команды:"
echo "  pm2 logs messenger-server  - просмотр логов"
echo "  pm2 restart messenger-server  - перезапуск"
echo "  pm2 stop messenger-server  - остановка"
echo "  pm2 status  - статус всех процессов"
echo ""
echo "🌐 Приложение доступно по адресу:"
echo "  Фронтенд: http://$SERVER_ADDRESS"
echo "  API: http://$SERVER_ADDRESS:3000"
echo ""
echo "⚠️  Не забудьте настроить Nginx для production!"
echo "   Инструкции в файле DEPLOY.md"
