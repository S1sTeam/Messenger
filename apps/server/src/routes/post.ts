import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

export const postRouter = Router();

postRouter.get('/feed', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    
    console.log('📰 Loading feed for user:', userId);
    
    const posts = await prisma.post.findMany({
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
            userId
          },
          select: {
            id: true
          },
          take: 1
        },
        reposts: {
          where: {
            userId
          },
          select: {
            id: true
          },
          take: 1
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
    
    const postsWithUserData = posts.map(post => ({
      id: post.id,
      authorId: post.authorId,
      authorName: post.author.displayName,
      authorUsername: post.author.username || undefined,
      authorAvatar: post.author.avatar || '',
      content: post.content,
      images: post.images ? post.images.split(',').filter(Boolean) : [],
      comments: post._count.comments,
      createdAt: post.createdAt,
      isLiked: post.likes.length > 0,
      isReposted: post.reposts.length > 0,
      likes: post._count.likes,
      reposts: post._count.reposts
    }));
    
    console.log('✅ Loaded', postsWithUserData.length, 'posts');
    res.json({ posts: postsWithUserData });
  } catch (error) {
    console.error('❌ Feed loading error:', error);
    res.status(500).json({ error: 'Ошибка загрузки постов' });
  }
});

postRouter.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { content, images } = req.body;
    const userId = req.userId!;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Содержимое поста обязательно' });
    }

    const post = await prisma.post.create({
      data: {
        content,
        images: images && images.length > 0 ? images.join(',') : '',
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
        }
      }
    });

    console.log('✅ Post created:', post.id, 'by', post.author.displayName);
    
    res.json({
      post: {
        id: post.id,
        authorId: post.authorId,
        authorName: post.author.displayName,
        authorUsername: post.author.username || undefined,
        authorAvatar: post.author.avatar || '',
        content: post.content,
        images: post.images ? post.images.split(',').filter(Boolean) : [],
        comments: 0,
        createdAt: post.createdAt,
        isLiked: false,
        isReposted: false,
        likes: 0,
        reposts: 0
      }
    });
  } catch (error) {
    console.error('❌ Post creation error:', error);
    res.status(500).json({ error: 'Ошибка создания поста' });
  }
});

postRouter.post('/:postId/like', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    if (existingLike) {
      await prisma.like.delete({
        where: {
          postId_userId: {
            postId,
            userId
          }
        }
      });
      console.log('👎 Post unliked:', postId);
    } else {
      await prisma.like.create({
        data: {
          postId,
          userId
        }
      });
      console.log('👍 Post liked:', postId);
    }

    const likesCount = await prisma.like.count({
      where: { postId }
    });

    res.json({ 
      likes: likesCount,
      isLiked: !existingLike
    });
  } catch (error) {
    console.error('❌ Like error:', error);
    res.status(500).json({ error: 'Ошибка лайка' });
  }
});

postRouter.post('/:postId/repost', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const existingRepost = await prisma.repost.findUnique({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    if (existingRepost) {
      await prisma.repost.delete({
        where: {
          postId_userId: {
            postId,
            userId
          }
        }
      });
      console.log('🔄 Post unreposted:', postId);
    } else {
      await prisma.repost.create({
        data: {
          postId,
          userId
        }
      });
      console.log('🔄 Post reposted:', postId);
    }

    const repostsCount = await prisma.repost.count({
      where: { postId }
    });

    res.json({ 
      reposts: repostsCount,
      isReposted: !existingRepost
    });
  } catch (error) {
    console.error('❌ Repost error:', error);
    res.status(500).json({ error: 'Ошибка репоста' });
  }
});

postRouter.delete('/:postId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }

    await prisma.post.delete({
      where: { id: postId }
    });

    console.log('🗑️ Post deleted:', postId);
    res.json({ message: 'Пост удален' });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Ошибка удаления поста' });
  }
});

// Получить комментарии к посту (с вложенными)
postRouter.get('/:postId/comments', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { postId } = req.params;

    // Получаем пост для определения автора
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }

    // Получаем все комментарии
    const comments = await prisma.comment.findMany({
      where: { 
        postId,
        parentId: null // Только корневые комментарии
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatar: true
              }
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatar: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const formatComment = (comment: any): any => ({
      id: comment.id,
      content: comment.content,
      authorId: comment.userId,
      authorName: comment.user.displayName,
      authorUsername: comment.user.username || undefined,
      authorAvatar: comment.user.avatar || '',
      isPostAuthor: comment.userId === post.authorId,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      replies: comment.replies ? comment.replies.map(formatComment) : []
    });

    const commentsWithUserData = comments.map(formatComment);

    res.json({ comments: commentsWithUserData, postAuthorId: post.authorId });
  } catch (error) {
    console.error('❌ Comments loading error:', error);
    res.status(500).json({ error: 'Ошибка загрузки комментариев' });
  }
});

// Добавить комментарий (с поддержкой ответов)
postRouter.post('/:postId/comments', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.userId!;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Содержимое комментария обязательно' });
    }

    // Получаем пост для определения автора
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId,
        parentId: parentId || null
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    console.log('💬 Comment created:', comment.id, 'by', comment.user.displayName);

    res.json({
      comment: {
        id: comment.id,
        content: comment.content,
        authorId: comment.userId,
        authorName: comment.user.displayName,
        authorUsername: comment.user.username || undefined,
        authorAvatar: comment.user.avatar || '',
        isPostAuthor: comment.userId === post.authorId,
        createdAt: comment.createdAt,
        parentId: comment.parentId,
        replies: []
      }
    });
  } catch (error) {
    console.error('❌ Comment creation error:', error);
    res.status(500).json({ error: 'Ошибка создания комментария' });
  }
});
