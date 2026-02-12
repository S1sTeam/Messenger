// Простая проверка подключения к PostgreSQL
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './apps/server/.env' });

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

console.log('🔍 Проверка подключения к PostgreSQL...');
console.log('📍 URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

try {
  await client.connect();
  console.log('✅ Подключение успешно!');
  
  const result = await client.query('SELECT version()');
  console.log('📊 Версия PostgreSQL:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
  
  await client.end();
  console.log('\n✨ База данных готова к работе!');
  console.log('📝 Следующий шаг: npm run prisma:migrate');
} catch (error) {
  console.error('\n❌ Ошибка подключения:', error.message);
  console.log('\n💡 Возможные решения:');
  console.log('1. Убедитесь, что PostgreSQL запущен');
  console.log('2. Проверьте DATABASE_URL в apps/server/.env');
  console.log('3. Если используете Docker:');
  console.log('   docker run --name messenger-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=messenger -p 5432:5432 -d postgres:15');
  process.exit(1);
}
