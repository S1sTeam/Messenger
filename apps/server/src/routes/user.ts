import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

export const userRouter = Router();

// Search users by display name, username or phone.
userRouter.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const userId = req.userId!;

    if (!query) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { displayName: { contains: query } },
              { username: { contains: query } },
              { phone: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        bio: true,
      },
      take: 20,
    });

    res.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Ошибка поиска пользователей' });
  }
});

// Suggested accounts for feed sidebar.
userRouter.get('/suggested/list', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const users = await prisma.user.findMany({
      where: {
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        followers: {
          where: {
            followerId: userId,
          },
          select: {
            id: true,
          },
          take: 1,
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    const usersWithFollowStatus = users.map((item) => ({
      id: item.id,
      displayName: item.displayName,
      username: item.username,
      phone: item.phone,
      avatar: item.avatar,
      _count: item._count,
      isFollowing: item.followers.length > 0,
    }));

    res.json({ users: usersWithFollowStatus });
  } catch (error) {
    console.error('Suggested users error:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// Get posts by user.
userRouter.get('/:userId/posts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Некорректный userId' });
    }

    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        likes: {
          where: {
            userId: currentUserId,
          },
        },
        reposts: {
          where: {
            userId: currentUserId,
          },
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedPosts = posts.map((post) => ({
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
      createdAt: post.createdAt,
    }));

    res.json({ posts: formattedPosts });
  } catch (error) {
    console.error('User posts error:', error);
    res.status(500).json({ error: 'Ошибка загрузки постов' });
  }
});

// Follow/unfollow target user.
userRouter.post('/:userId/follow', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Некорректный userId' });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Нельзя подписаться на себя' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userId,
      },
      select: {
        id: true,
      },
    });

    let isFollowing = false;
    if (existingFollow) {
      await prisma.follow.delete({
        where: {
          id: existingFollow.id,
        },
      });
    } else {
      await prisma.follow.create({
        data: {
          followerId: currentUserId,
          followingId: userId,
        },
      });
      isFollowing = true;
    }

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ]);

    res.json({ isFollowing, followersCount, followingCount });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

// Follow status + counters for profile.
userRouter.get('/:userId/follow-status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId!;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Некорректный userId' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const [isFollowing, followersCount, followingCount] = await Promise.all([
      prisma.follow.findFirst({
        where: {
          followerId: currentUserId,
          followingId: userId,
        },
        select: {
          id: true,
        },
      }),
      prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ]);

    res.json({
      isFollowing: !!isFollowing,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error('Follow status error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статуса подписки' });
  }
});

// Get user profile.
userRouter.get('/:userId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Некорректный userId' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});
