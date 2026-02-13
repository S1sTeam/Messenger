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
import { prepareDatabasePerformance } from './db.js';

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
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

const envCorsOrigins = (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]));
const corsOriginSet = new Set(corsOrigins);
const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const localhostOriginPattern = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/;
const localNetworkPattern = /^http:\/\/192\.168\.\d+\.\d+:\d+$/;

const isOriginAllowed = (origin?: string) => {
  if (!origin) return true;

  if (corsOriginSet.has(origin)) return true;
  if (localhostOriginPattern.test(origin)) return true;
  if (localNetworkPattern.test(origin)) return true;

  return false;
};

const resolveCorsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${origin || 'unknown'}`));
};

const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    credentials: true,
    methods: corsMethods,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(
  cors({
    origin: resolveCorsOrigin,
    credentials: true,
    methods: corsMethods,
  })
);
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/chats', chatRouter);
app.use('/api/posts', postRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', userRouter);
app.use('/api/upload', uploadRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;

const start = async () => {
  await prepareDatabasePerformance();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
