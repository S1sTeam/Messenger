@echo off
echo ========================================
echo   Messenger Desktop - Запуск
echo ========================================
echo.

echo [1/2] Запуск сервера...
start "Messenger Server" cmd /k "cd apps\server && npm run dev"
timeout /t 3 /nobreak > nul

echo [2/2] Запуск Desktop приложения...
cd apps\desktop
npm run tauri dev

pause
