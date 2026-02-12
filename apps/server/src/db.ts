import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbPrepared?: boolean;
};

const prismaLogs: Array<'query' | 'error' | 'warn' | 'info'> =
  process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'];

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: prismaLogs,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const prepareDatabasePerformance = async () => {
  if (globalForPrisma.dbPrepared) {
    return;
  }

  try {
    // SQLite runtime tuning for low-latency reads/writes on single-node VPS.
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$executeRawUnsafe('PRAGMA temp_store = MEMORY;');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');

    // Frequently used query paths.
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_chat_participant_user_id" ON "ChatParticipant"("userId");');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_message_chat_id_created_at" ON "Message"("chatId", "createdAt");');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_post_created_at" ON "Post"("createdAt");');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_comment_post_parent" ON "Comment"("postId", "parentId");');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_follow_following_id" ON "Follow"("followingId");');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_follow_follower_id" ON "Follow"("followerId");');

    globalForPrisma.dbPrepared = true;
    console.log('Database performance profile enabled');
  } catch (error) {
    console.error('Failed to prepare database performance profile:', error);
  }
};
