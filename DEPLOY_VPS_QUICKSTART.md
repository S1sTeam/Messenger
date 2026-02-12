# Messenger VPS Quickstart

## 1) Prepare server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2) Upload project and install deps

```bash
cd ~
git clone <YOUR_REPO_URL> messenger
cd messenger
npm ci
```

## 3) Backend env

Create `apps/server/.env`:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=file:./prisma/dev.db
JWT_SECRET=change-this-secret
CORS_ORIGINS=https://your-domain.com,http://your-vps-ip

# SMS provider for real phone auth
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

# Free test option (limited):
# SMS_PROVIDER=textbelt
# TEXTBELT_KEY=textbelt
```

## 4) Database

```bash
cd apps/server
npx prisma generate
npx prisma migrate deploy
cd ../..
```

## 5) Frontend env and build

Create `apps/web/.env.production`:

```env
VITE_API_URL=https://your-domain.com
VITE_SOCKET_URL=https://your-domain.com
```

Build:

```bash
npm run build --workspace=apps/web
```

## 6) Run backend with PM2

```bash
pm2 start npm --name messenger-server -- run start --workspace=apps/server
pm2 save
pm2 startup
```

## 7) Nginx config

Create `/etc/nginx/sites-available/messenger`:

```nginx
server {
  listen 80;
  server_name your-domain.com;

  root /home/<user>/messenger/apps/web/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /socket.io {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Enable config:

```bash
sudo ln -sf /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/messenger
sudo nginx -t
sudo systemctl restart nginx
```

## 8) Open firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
```

## 9) Verify from another device

1. Open `http://your-domain.com` (or VPS IP).
2. Login by phone number and SMS code from another device.
3. Send message and check that `/api` and `/socket.io` work.
