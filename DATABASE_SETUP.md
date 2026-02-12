# Настройка базы данных PostgreSQL

## Установка PostgreSQL

### Windows
1. Скачайте PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
2. Запустите установщик и следуйте инструкциям
3. Запомните пароль для пользователя `postgres`
4. По умолчанию PostgreSQL будет работать на порту 5432

### Альтернатива: Docker
```bash
docker run --name messenger-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=messenger -p 5432:5432 -d postgres:15
```

## Настройка базы данных

1. Откройте pgAdmin или подключитесь через командную строку:
```bash
psql -U postgres
```

2. Создайте базу данных (если не используете Docker):
```sql
CREATE DATABASE messenger;
```

3. Проверьте подключение в файле `apps/server/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/messenger
```

Замените `postgres:postgres` на ваши `username:password` если они отличаются.

## Запуск миграций

После установки и настройки PostgreSQL:

```bash
cd apps/server
npm run prisma:generate
npm run prisma:migrate
```

Это создаст все необходимые таблицы в базе данных.

## Просмотр данных

Для просмотра данных в базе используйте Prisma Studio:

```bash
cd apps/server
npm run prisma:studio
```

Откроется веб-интерфейс на http://localhost:5555

## Сброс базы данных

Если нужно удалить все данные и начать заново:

```bash
cd apps/server
npx prisma migrate reset
```

⚠️ Это удалит ВСЕ данные из базы!

## Проверка статуса

Проверьте, что PostgreSQL запущен:

### Windows
- Откройте "Службы" (services.msc)
- Найдите "postgresql-x64-15" (или похожее название)
- Убедитесь, что служба запущена

### Docker
```bash
docker ps
```

Должен быть запущен контейнер `messenger-postgres`
