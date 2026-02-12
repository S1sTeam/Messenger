import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

export const userRouter = Router();

// Поиск пользователей
userRouter.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;
    const userId = req.userId!;

    if (!q || typeof q !== 'string') {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            id: {
              not: userId // Исключаем текущего пользователя
            }
          },
          {
            OR: [
              {
                displayName: {
                  contains: q
                }
              },
              {
                username: {
                  contains: q
                }
              },
              {
                phone: {
                  contains: q
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        bio: true
      },
      take: 20
    });

    res.json({ users });
  } catch (error) {
    console.error('❌ User search error:', error);
    res.status(500).json({ error: 'Ошибка поиска пользователей' });
  }
});

// Получить профиль пользователя
userRouter.get('/:userId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        bio: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user });
  } catch (error) {
    console.error('❌ User fetch error:', error);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

// Получить рекомендуемых пользователей
userRouter.get('/suggested/list', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const users = await prisma.user.findMany({
      where: {
        id: {
          not: userId
        }
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        _count: {
          select: {
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    res.json({ users });
  } catch (error) {
    console.error('❌ Suggested users error:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// Получить посты пользователя
userRouter.get('/:userId/posts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    const posts = await prisma.post.findMany({
      where: {
        authorId: userId
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true
          }
        },
        likes: {
          where: {
            userId: currentUserId
          }
        },
        reposts: {
          where: {
            userId: currentUserId
          }
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
            comments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedPosts = posts.map(post => ({
      id: post.id,
      authorId: post.authorId,
      authorName: post.author.displayName,
      authorAvatar: post.author.avatar,
      content: post.content,
      images: post.images,
      likes: post._count.likes,
      reposts: post._count.reposts,
      comments: post._count.comments,
      isLiked: post.likes.length > 0,
      isReposted: post.reposts.length > 0,
      createdAt: post.createdAt
    }));

    res.json({ posts: formattedPosts });
  } catch (error) {
    console.error('❌ User posts error:', error);
    res.status(500).json({ error: 'Ошибка загрузки постов' });
  }
});

// Подписаться/отписаться от пользователя
userRouter.post('/:userId/follow', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Нельзя подписаться на себя' });
    }

    // Проверяем, существует ли подписка
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: userId
        }
      }
    });

    if (existingFollow) {
      // Отписываемся
      await prisma.follow.delete({
        where: {
          id: existingFollow.id
        }
      });
      res.json({ isFollowing: false });
    } else {
      // Подписываемся
      await prisma.follow.create({
        data: {
          followerId: currentUserId,
          followingId: userId
        }
      });
      res.json({ isFollowing: true });
    }
  } catch (error) {
    console.error('❌ Follow error:', error);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

// Получить статус подписки и счетчики
userRouter.get('/:userId/follow-status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    const [isFollowing, followersCount, followingCount] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId
          }
        }
      }),
      prisma.follow.count({
        where: {
          followingId: userId
        }
      }),
      prisma.follow.count({
        where: {
          followerId: userId
        }
      })
    ]);

    res.json({
      isFollowing: !!isFollowing,
      followersCount,
      followingCount
    });
  } catch (error) {
    console.error('❌ Follow status error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статуса подписки' });
  }
});
