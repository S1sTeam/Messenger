# Деплой мессенджера на VPS

## Требования
- Ubuntu 20.04+ или другой Linux
- Node.js 18+
- Nginx
- PM2 (для управления процессами)
- Домен (опционально, для HTTPS)

## Шаг 1: Подготовка VPS

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Устанавливаем PM2
sudo npm install -g pm2

# Устанавливаем Nginx
sudo apt install -y nginx

# Устанавливаем Git
sudo apt install -y git
```

## Шаг 2: Клонирование проекта

```bash
# Переходим в домашнюю директорию
cd ~

# Клонируем репозиторий (или загружаем файлы)
git clone <your-repo-url> messenger
cd messenger

# Или загружаем через SCP/SFTP
# scp -r ./Messenger user@your-vps-ip:/home/user/messenger
```

## Шаг 3: Установка зависимостей

```bash
# Устанавливаем зависимости
npm install

# Устанавливаем зависимости для сервера
cd apps/server
npm install

# Устанавливаем зависимости для веб-клиента
cd ../web
npm install

cd ../..
```

## Шаг 4: Настройка переменных окружения

```bash
# Создаем .env для сервера
cd apps/server
nano .env
```

Добавьте:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-this"
PORT=3000
NODE_ENV=production
```

## Шаг 5: Настройка базы данных

```bash
# Генерируем Prisma Client
npx prisma generate

# Применяем миграции
npx prisma migrate deploy

cd ../..
```

## Шаг 6: Сборка фронтенда

```bash
cd apps/web

# Создаем .env для production
echo "VITE_API_URL=http://your-vps-ip:3000" > .env.production

# Или для домена:
# echo "VITE_API_URL=https://api.yourdomain.com" > .env.production

# Собираем production версию
npm run build

cd ../..
```

## Шаг 7: Настройка PM2

Создайте файл `ecosystem.config.js` в корне проекта:

```javascript
module.exports = {
  apps: [
    {
      name: 'messenger-server',
      cwd: './apps/server',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

Запустите сервер:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Шаг 8: Настройка Nginx

```bash
sudo nano /etc/nginx/sites-available/messenger
```

Добавьте конфигурацию:
```nginx
# Фронтенд
server {
    listen 80;
    server_name your-domain.com;  # или IP адрес

    root /home/user/messenger/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API запросов
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket для Socket.io
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Шаг 9: Настройка Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## Шаг 10: SSL (опционально, но рекомендуется)

```bash
# Устанавливаем Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получаем SSL сертификат
sudo certbot --nginx -d your-domain.com

# Автообновление сертификата
sudo certbot renew --dry-run
```

## Управление приложением

```bash
# Просмотр логов
pm2 logs messenger-server

# Перезапуск
pm2 restart messenger-server

# Остановка
pm2 stop messenger-server

# Статус
pm2 status

# Мониторинг
pm2 monit
```

## Обновление приложения

```bash
cd ~/messenger

# Получаем изменения
git pull

# Обновляем зависимости
npm install
cd apps/server && npm install
cd ../web && npm install

# Применяем миграции БД
cd apps/server
npx prisma migrate deploy

# Пересобираем фронтенд
cd ../web
npm run build

# Перезапускаем сервер
cd ../..
pm2 restart messenger-server
```

## Резервное копирование

```bash
# Создаем бэкап базы данных
cp apps/server/prisma/dev.db backups/dev.db.$(date +%Y%m%d_%H%M%S)

# Автоматический бэкап (добавьте в crontab)
# crontab -e
# 0 2 * * * cp /home/user/messenger/apps/server/prisma/dev.db /home/user/backups/dev.db.$(date +\%Y\%m\%d)
```

## Проверка работы

1. Откройте браузер и перейдите на `http://your-vps-ip` или `http://your-domain.com`
2. Зарегистрируйтесь и войдите
3. Проверьте все функции: чаты, звонки, посты

## Troubleshooting

### Сервер не запускается
```bash
pm2 logs messenger-server
# Проверьте логи на ошибки
```

### Не работают WebSocket
```bash
# Проверьте Nginx конфигурацию
sudo nginx -t
sudo systemctl status nginx
```

### База данных не найдена
```bash
cd apps/server
npx prisma migrate deploy
npx prisma generate
```

### Порт занят
```bash
# Найдите процесс на порту 3000
sudo lsof -i :3000
# Убейте процесс
sudo kill -9 <PID>
```

## Мониторинг

```bash
# Установка мониторинга
pm2 install pm2-logrotate

# Настройка ротации логов
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Безопасность

1. Измените JWT_SECRET на случайную строку
2. Используйте HTTPS (SSL)
3. Настройте firewall
4. Регулярно обновляйте систему
5. Делайте бэкапы базы данных
6. Используйте сильные пароли

## Производительность

```bash
# Увеличьте лимиты для Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Настройте PM2 для использования всех ядер
pm2 start ecosystem.config.js -i max
```
