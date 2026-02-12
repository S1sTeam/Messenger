# Messenger Desktop

Desktop приложение на базе Tauri + React.

## Требования

1. **Node.js** (уже установлен)
2. **Rust** - нужно установить:
   - Windows: https://www.rust-lang.org/tools/install
   - Скачай `rustup-init.exe` и запусти
   - После установки перезапусти терминал

## Установка зависимостей

```bash
cd apps/desktop
npm install
```

## Запуск в режиме разработки

**Важно:** Сначала запусти сервер!

```bash
# В одном терминале - сервер
cd apps/server
npm run dev

# В другом терминале - desktop приложение
cd apps/desktop
npm run tauri dev
```

## Сборка приложения

```bash
cd apps/desktop
npm run tauri build
```

Готовое приложение будет в `apps/desktop/src-tauri/target/release/`

## Особенности Desktop версии

- ✅ Нативное приложение (быстрее Electron)
- ✅ Маленький размер (~10-15 MB)
- ✅ Все функции веб-версии
- ✅ Работает на Windows/Mac/Linux
- ✅ Автоматические обновления (можно настроить)
- ✅ Системные уведомления
- ✅ Трей иконка

## Горячие клавиши

- `Ctrl+Q` - Выход
- `Ctrl+W` - Закрыть окно
- `Ctrl+M` - Свернуть
- `F11` - Полный экран

## Troubleshooting

### Ошибка "Rust not found"
Установи Rust: https://www.rust-lang.org/tools/install

### Ошибка при сборке
```bash
# Очисти кэш
cd apps/desktop/src-tauri
cargo clean
cd ../..
npm run tauri build
```

### Приложение не подключается к серверу
Убедись что сервер запущен на `http://localhost:3000`
