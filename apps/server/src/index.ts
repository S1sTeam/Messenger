import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { postRouter } from './routes/post.js';
import { settingsRouter } from './routes/settings.js';
import { userRouter } from './routes/user.js';
import uploadRouter from './routes/upload.js';
import { setupSocketHandlers } from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Prefer `apps/server/.env` for stable workspace runs, then fallback to cwd `.env`.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const httpServer = createServer(app);
const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost'
];

const envCorsOrigins = (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]));
const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: corsMethods
  }
});

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: corsMethods
}));
app.use(express.json());

// Статические файлы для загрузок
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/chats', chatRouter);
app.use('/api/posts', postRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', userRouter);
app.use('/api/upload', uploadRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
