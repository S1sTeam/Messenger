# Messenger App

Кроссплатформенный мессенджер с функциями Telegram и Twitter.

## Структура проекта

- `apps/server` - Backend (Node.js + Express + Socket.io + PostgreSQL)
- `apps/web` - Web приложение (React)
- `apps/desktop` - Desktop приложение (Tauri + React)
- `apps/mobile` - Mobile приложение (React Native)
- `packages/shared` - Общие типы, утилиты, компоненты

## Запуск

### Backend
```bash
npm run dev:server
```

### Web
```bash
npm run dev:web
```

### Desktop (Tauri)
```bash
npm run dev:desktop
```

### Mobile (React Native)
```bash
npm run dev:mobile
```

## Требования

- Node.js 18+
- Rust (для Tauri)
- PostgreSQL
- Redis
