import { create } from 'zustand';

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  images?: string[];
  likes: number;
  reposts: number;
  comments: number;
  isLiked: boolean;
  isReposted: boolean;
  createdAt: Date;
}

interface FeedState {
  posts: Post[];
  loading: boolean;
  
  loadPosts: () => Promise<void>;
  createPost: (content: string, images?: string[]) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  repostPost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  loading: false,

  loadPosts: async () => {
    set({ loading: true });
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) {
        console.log('⚠️ No auth storage found');
        set({ loading: false });
        return;
      }
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) {
        console.log('⚠️ No token found');
        set({ loading: false });
        return;
      }

      console.log('📡 Loading posts...');
      const response = await fetch('http://localhost:3000/api/posts/feed', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Failed to load posts:', response.status, error);
        throw new Error('Failed to load posts');
      }

      const data = await response.json();
      console.log('📰 Posts loaded:', data.posts.length, 'posts');
      set({ posts: data.posts || [], loading: false });
    } catch (error) {
      console.error('❌ Failed to load posts:', error);
      set({ loading: false, posts: [] });
    }
  },

  createPost: async (content: string, images?: string[]) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) {
        throw new Error('Not authenticated');
      }
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      console.log('📤 Creating post...');
      const response = await fetch('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, images })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Failed to create post:', error);
        throw new Error(error.error || 'Failed to create post');
      }

      const data = await response.json();
      console.log('✅ Post created:', data.post);
      
      // Add new post to the beginning
      set((state) => ({
        posts: [data.post, ...state.posts]
      }));
    } catch (error) {
      console.error('❌ Failed to create post:', error);
      throw error;
    }
  },

  likePost: async (postId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      console.log('👍 Liking post:', postId);
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to like post');
        throw new Error('Failed to like post');
      }

      const data = await response.json();
      console.log('✅ Like response:', data);

      // Update UI with server response
      set((state) => ({
        posts: state.posts.map(post =>
          post.id === postId
            ? {
                ...post,
                likes: data.likes,
                isLiked: data.isLiked
              }
            : post
        )
      }));
    } catch (error) {
      console.error('❌ Failed to like post:', error);
    }
  },

  repostPost: async (postId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      console.log('🔄 Reposting:', postId);
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/repost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to repost');
        throw new Error('Failed to repost');
      }

      const data = await response.json();
      console.log('✅ Repost response:', data);

      // Update UI with server response
      set((state) => ({
        posts: state.posts.map(post =>
          post.id === postId
            ? {
                ...post,
                reposts: data.reposts,
                isReposted: data.isReposted
              }
            : post
        )
      }));
    } catch (error) {
      console.error('❌ Failed to repost:', error);
    }
  },

  deletePost: async (postId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete post');

      set((state) => ({
        posts: state.posts.filter(post => post.id !== postId)
      }));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  }
}));
