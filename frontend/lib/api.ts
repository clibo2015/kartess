import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getToken, getRefreshToken, setToken, clearAuth } from './auth';
import { AuthResponse } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add JWT token to headers
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're currently redirecting to avoid multiple redirects
let isRedirecting = false;
// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
// Queue of requests waiting for token refresh
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
  config: InternalAxiosRequestConfig;
}> = [];

// Process queued requests after token refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      if (prom.config.headers) {
        prom.config.headers.Authorization = `Bearer ${token}`;
      }
      prom.resolve(api(prom.config));
    }
  });
  
  failedQueue = [];
};

// Response interceptor: Handle 401 (unauthorized) with token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we're already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();

      // If no refresh token, clear auth and redirect to login
      if (!refreshToken) {
        isRefreshing = false;
        clearAuth();
        
        if (typeof window !== 'undefined' && !isRedirecting) {
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/login') && 
              !currentPath.includes('/register') &&
              !currentPath.includes('/profile-complete')) {
            isRedirecting = true;
            setTimeout(() => {
              const stillOnProtectedPage = !window.location.pathname.includes('/login') &&
                                        !window.location.pathname.includes('/register') &&
                                        !window.location.pathname.includes('/profile-complete');
              if (stillOnProtectedPage) {
                window.location.href = '/login';
              }
              setTimeout(() => {
                isRedirecting = false;
              }, 1000);
            }, 200);
          }
        }
        
        processQueue(error, null);
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { token: newToken } = response.data;

        // Update stored token
        setToken(newToken);

        // Update original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        // Process queued requests
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        isRefreshing = false;
        clearAuth();
        processQueue(refreshError, null);

        if (typeof window !== 'undefined' && !isRedirecting) {
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/login') && 
              !currentPath.includes('/register') &&
              !currentPath.includes('/profile-complete')) {
            isRedirecting = true;
            setTimeout(() => {
              const stillOnProtectedPage = !window.location.pathname.includes('/login') &&
                                        !window.location.pathname.includes('/register') &&
                                        !window.location.pathname.includes('/profile-complete');
              if (stillOnProtectedPage) {
                window.location.href = '/login';
              }
              setTimeout(() => {
                isRedirecting = false;
              }, 1000);
            }, 200);
          }
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  register: async (data: {
    full_name: string;
    email: string;
    username: string;
    password: string;
    qr_token?: string;
  }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<{ token: string }> => {
    const response = await api.post<{ token: string }>('/api/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },

  verify: async (): Promise<{
    user: any;
    profileComplete: boolean;
    profile: any;
  }> => {
    const response = await api.post('/api/auth/verify');
    return response.data;
  },
};

export const profileAPI = {
  getProfile: async (): Promise<{ profile: any }> => {
    const response = await api.get('/api/profile');
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/api/profile/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateProfile: async (data: {
    bio?: string;
    company?: string;
    position?: string;
    phone?: string;
    education?: string;
    avatar_url?: string;
  }): Promise<{ message: string; profile: any }> => {
    const response = await api.put('/api/profile', data);
    return response.data;
  },

  complete: async (data: {
    bio: string;
    company?: string;
    position?: string;
    phone?: string;
    education?: string;
    avatar_url?: string;
  }): Promise<{ message: string; profile: any }> => {
    const response = await api.post('/api/profile/complete', data);
    return response.data;
  },
};

export const postsAPI = {
  create: async (data: {
    content: string;
    module: string;
    visibility?: string;
    network_type?: 'personal' | 'professional' | 'both';
    tags?: string[];
    media?: File[];
    is_poll?: boolean;
    is_reel?: boolean;
  }): Promise<any> => {
    const formData = new FormData();
    formData.append('content', data.content);
    formData.append('module', data.module);
    if (data.visibility) formData.append('visibility', data.visibility);
    if (data.network_type) formData.append('network_type', data.network_type);
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.media) {
      data.media.forEach((file) => {
        formData.append('media', file);
      });
    }
    if (data.is_poll !== undefined) formData.append('is_poll', String(data.is_poll));
    if (data.is_reel !== undefined) formData.append('is_reel', String(data.is_reel));
    if (data.is_reel !== undefined) formData.append('is_reel', String(data.is_reel));

    const response = await api.post('/api/posts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getTimeline: async (params: {
    module?: string;
    sort?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ posts: any[]; nextCursor: string | null }> => {
    const response = await api.get('/api/posts/timeline', { params });
    return response.data;
  },

  getModulePosts: async (
    module: string,
    params?: {
      cursor?: string;
      limit?: number;
    }
  ): Promise<{ posts: any[]; nextCursor: string | null }> => {
    const response = await api.get(`/api/posts/module/${module}`, { params });
    return response.data;
  },

  getUserPosts: async (userId: string, params?: {
    module?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ posts: any[]; nextCursor: string | null }> => {
    const response = await api.get(`/api/posts/user/${userId}`, { params });
    return response.data;
  },

  getPost: async (postId: string): Promise<any> => {
    const response = await api.get(`/api/posts/${postId}`);
    return response.data;
  },

  getReels: async (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{ posts: any[]; nextCursor: string | null }> => {
    const response = await api.get('/api/posts/reels', { params });
    return response.data;
  },

  repost: async (postId: string, data?: { content?: string; module?: string }): Promise<any> => {
    const response = await api.post(`/api/posts/${postId}/repost`, data || {});
    return response.data;
  },

  delete: async (postId: string): Promise<void> => {
    await api.delete(`/api/posts/${postId}`);
  },
};

export const searchAPI = {
  search: async (query: string, type?: string): Promise<{
    users: any[];
    posts: any[];
    hashtags: any[];
  }> => {
    const response = await api.get('/api/search', {
      params: { q: query, type },
    });
    return response.data;
  },

  autocomplete: async (query: string, type: string = 'hashtags'): Promise<{
    suggestions: any[];
  }> => {
    const response = await api.get('/api/search/autocomplete', {
      params: { q: query, type },
    });
    return response.data;
  },
};

export const contactsAPI = {
  follow: async (receiverId: string, presetName?: string): Promise<any> => {
    const response = await api.post('/api/contacts/follow', { 
      receiver_id: receiverId,
      preset_name: presetName,
    });
    return response.data;
  },

  approve: async (contactId: string, presetName?: string): Promise<any> => {
    const response = await api.post('/api/contacts/approve', { 
      contact_id: contactId,
      preset_name: presetName,
    });
    return response.data;
  },

  unfollow: async (contactId?: string, userId?: string): Promise<any> => {
    const response = await api.delete('/api/contacts/unfollow', {
      data: { contact_id: contactId, user_id: userId },
    });
    return response.data;
  },

  getContacts: async (): Promise<{ contacts: any[] }> => {
    const response = await api.get('/api/contacts');
    return response.data;
  },

  getPending: async (): Promise<{ pending: any[] }> => {
    const response = await api.get('/api/contacts/pending');
    return response.data;
  },
};

export const presetsAPI = {
  getPresets: async (): Promise<{ presets: any }> => {
    const response = await api.get('/api/presets');
    return response.data;
  },

  updatePresets: async (presets: any): Promise<{ message: string; presets: any }> => {
    const response = await api.put('/api/presets', presets);
    return response.data;
  },

  getSharedData: async (userId: string, presetName: string): Promise<{ shared_data: any }> => {
    const response = await api.post('/api/presets/get-shared-data', {
      user_id: userId,
      preset_name: presetName,
    });
    return response.data;
  },
};

export const qrAPI = {
  generate: async (presetName: string): Promise<{ token: string; expires_at: string; qr_token_id: string }> => {
    const response = await api.post('/api/qr/generate', { preset_name: presetName });
    return response.data;
  },

  validate: async (token: string): Promise<{ valid: boolean; user?: any; requires_signup?: boolean; error?: string }> => {
    // Public endpoint - no auth required
    const response = await axios.get(`${API_URL}/api/qr/validate/${token}`);
    return response.data;
  },

  consume: async (token: string, presetName: string): Promise<any> => {
    const response = await api.post('/api/qr/consume', { token, preset_name: presetName });
    return response.data;
  },

  consumeAfterSignup: async (token: string): Promise<any> => {
    const response = await api.post('/api/qr/consume-after-signup', { token });
    return response.data;
  },
};

export const chatsAPI = {
  getThreads: async (): Promise<{ threads: any[] }> => {
    const response = await api.get('/api/chats/threads');
    return response.data;
  },

  createThread: async (data: {
    type?: string;
    name?: string;
    participant_ids: string[];
  }): Promise<{ thread: any }> => {
    const response = await api.post('/api/chats/threads', data);
    return response.data;
  },

  getMessages: async (threadId: string, params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ messages: any[]; nextCursor: string | null }> => {
    const response = await api.get(`/api/chats/threads/${threadId}/messages`, { params });
    return response.data;
  },

  deleteThread: async (threadId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/chats/threads/${threadId}`);
    return response.data;
  },
};

export const messagesAPI = {
  send: async (data: {
    thread_id: string;
    content: string;
    encrypted?: boolean;
    media?: File[];
  }): Promise<any> => {
    const formData = new FormData();
    formData.append('thread_id', data.thread_id);
    formData.append('content', data.content);
    if (data.encrypted !== undefined) formData.append('encrypted', String(data.encrypted));
    if (data.media) {
      data.media.forEach((file) => {
        formData.append('media', file);
      });
    }

    const response = await api.post('/api/messages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (messageId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/messages/${messageId}`);
    return response.data;
  },
};

export const notificationsAPI = {
  getNotifications: async (params?: {
    limit?: number;
    unread_only?: boolean;
  }): Promise<{ notifications: any[]; unreadCount: number }> => {
    const response = await api.get('/api/notifications', { params });
    return response.data;
  },

  markRead: async (notificationId: string): Promise<any> => {
    const response = await api.put(`/api/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllRead: async (): Promise<{ message: string }> => {
    const response = await api.put('/api/notifications/read-all');
    return response.data;
  },
};

export const reactionsAPI = {
  react: async (postId: string, type: string): Promise<any> => {
    const response = await api.post('/api/reactions', { post_id: postId, type });
    return response.data;
  },

  getPostReactions: async (postId: string): Promise<{ reactions: any; total: number }> => {
    const response = await api.get(`/api/reactions/post/${postId}`);
    return response.data;
  },

  deleteReaction: async (reactionId: string): Promise<any> => {
    const response = await api.delete(`/api/reactions/${reactionId}`);
    return response.data;
  },
};

export const commentsAPI = {
  create: async (data: {
    post_id: string;
    content: string;
    parent_id?: string;
  }): Promise<any> => {
    const response = await api.post('/api/comments', data);
    return response.data;
  },

  getPostComments: async (postId: string): Promise<{ comments: any[] }> => {
    const response = await api.get(`/api/comments/post/${postId}`);
    return response.data;
  },

  delete: async (commentId: string): Promise<any> => {
    const response = await api.delete(`/api/comments/${commentId}`);
    return response.data;
  },
};

export const storiesAPI = {
  create: async (file: File, content?: string, module?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('media', file);
    if (content) formData.append('content', content);
    if (module) formData.append('module', module);

    const response = await api.post('/api/stories', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getStories: async (): Promise<{ stories: any[] }> => {
    const response = await api.get('/api/stories');
    return response.data;
  },

  getUserStories: async (userId: string): Promise<{ stories: any[] }> => {
    const response = await api.get(`/api/stories/user/${userId}`);
    return response.data;
  },
};

export const threadsAPI = {
  getThreads: async (params?: {
    topic?: string;
    sort?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ threads: any[]; nextCursor: string | null }> => {
    const response = await api.get('/api/threads', { params });
    return response.data;
  },

  getTopics: async (): Promise<{ topics: Array<{ name: string; count: number }> }> => {
    const response = await api.get('/api/threads/topics');
    return response.data;
  },

  getThread: async (threadId: string): Promise<any> => {
    const response = await api.get(`/api/threads/${threadId}`);
    return response.data;
  },

  createThread: async (data: {
    title: string;
    content: string;
    topic?: string;
  }): Promise<any> => {
    const response = await api.post('/api/threads', data);
    return response.data;
  },

  createReply: async (
    threadId: string,
    data: {
      content: string;
      parent_id?: string;
    }
  ): Promise<any> => {
    const response = await api.post(`/api/threads/${threadId}/replies`, data);
    return response.data;
  },
};

export const careernetAPI = {
  getJobs: async (params?: {
    status?: string;
    type?: string;
    location?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ jobs: any[]; nextCursor: string | null }> => {
    const response = await api.get('/api/careernet/jobs', { params });
    return response.data;
  },

  getJob: async (jobId: string): Promise<any> => {
    const response = await api.get(`/api/careernet/jobs/${jobId}`);
    return response.data;
  },

  createJob: async (data: {
    title: string;
    description: string;
    company?: string;
    location?: string;
    type?: string;
    salary_range?: string;
    requirements?: string[];
    tags?: string[];
    application_url?: string;
    application_email?: string;
  }): Promise<any> => {
    const response = await api.post('/api/careernet/jobs', data);
    return response.data;
  },

  applyToJob: async (
    jobId: string,
    data: {
      cover_letter?: string;
      resume?: File;
    }
  ): Promise<any> => {
    const formData = new FormData();
    if (data.cover_letter) formData.append('cover_letter', data.cover_letter);
    if (data.resume) formData.append('resume', data.resume);

    const response = await api.post(`/api/careernet/jobs/${jobId}/apply`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getEndorsements: async (userId: string): Promise<{ endorsements: any }> => {
    const response = await api.get(`/api/careernet/endorsements/user/${userId}`);
    return response.data;
  },

  createEndorsement: async (data: {
    receiver_id: string;
    skill: string;
    message?: string;
  }): Promise<any> => {
    const response = await api.post('/api/careernet/endorsements', data);
    return response.data;
  },
};

export const liveAPI = {
  createSession: async (data: {
    type?: string;
    title?: string;
    description?: string;
    category?: string; // For live streams: 'Gaming', 'Music', 'Art & Creative', 'Technology', 'Education', 'Lifestyle', 'Other'
    scheduled_at?: string;
    thread_id?: string; // For calls: thread ID to call participants
  }): Promise<{
    session: any;
    roomUrl: string; // Daily.co room URL
    token: string; // Daily.co meeting token
    userId: string; // String user ID for reference
  }> => {
    const response = await api.post('/api/live/create', data);
    return response.data;
  },

  joinSession: async (sessionId: string): Promise<{
    session?: any;
    roomUrl: string; // Daily.co room URL
    token: string; // Daily.co meeting token
    userId: string; // String user ID for reference
  }> => {
    const response = await api.post(`/api/live/join/${sessionId}`);
    return response.data;
  },

  acceptCall: async (sessionId: string): Promise<{ session: any; roomUrl?: string; token?: string }> => {
    const response = await api.post(`/api/live/accept/${sessionId}`);
    return response.data;
  },

  rejectCall: async (sessionId: string): Promise<{ session: any }> => {
    const response = await api.post(`/api/live/reject/${sessionId}`);
    return response.data;
  },

  getSessions: async (): Promise<{ sessions: any[] }> => {
    const response = await api.get('/api/live/sessions');
    return response.data;
  },

  endSession: async (sessionId: string): Promise<any> => {
    const response = await api.post(`/api/live/end/${sessionId}`);
    return response.data;
  },
};

export const pollsAPI = {
  create: async (postId: string, options: string[]): Promise<any> => {
    const response = await api.post('/api/polls', { post_id: postId, options });
    return response.data;
  },

  getPoll: async (postId: string): Promise<any> => {
    const response = await api.get(`/api/polls/post/${postId}`);
    return response.data;
  },

  vote: async (postId: string, optionId: string): Promise<any> => {
    const response = await api.post('/api/polls/vote', { post_id: postId, option_id: optionId });
    return response.data;
  },
};

export const bookmarksAPI = {
  getBookmarks: async (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{ bookmarks: any[]; nextCursor: string | null }> => {
    const response = await api.get('/api/bookmarks', { params });
    return response.data;
  },

  bookmark: async (postId: string): Promise<any> => {
    const response = await api.post('/api/bookmarks', { post_id: postId });
    return response.data;
  },

  unbookmark: async (postId: string): Promise<any> => {
    const response = await api.delete(`/api/bookmarks/${postId}`);
    return response.data;
  },

  checkBookmarked: async (postId: string): Promise<{ bookmarked: boolean }> => {
    const response = await api.get(`/api/bookmarks/check/${postId}`);
    return response.data;
  },
};

export const highlightsAPI = {
  getHighlights: async (userId: string): Promise<{ highlights: any[] }> => {
    const response = await api.get(`/api/highlights/user/${userId}`);
    return response.data;
  },

  createHighlight: async (data: {
    title: string;
    story_ids: string[];
    cover_url?: string;
  }): Promise<any> => {
    const response = await api.post('/api/highlights', data);
    return response.data;
  },

  deleteHighlight: async (highlightId: string): Promise<any> => {
    const response = await api.delete(`/api/highlights/${highlightId}`);
    return response.data;
  },
};

export const usersAPI = {
  getSettings: async (): Promise<{ settings: any }> => {
    const response = await api.get('/api/users/settings');
    return response.data;
  },
  updateSettings: async (settings: { privacy?: any; notifications?: any }): Promise<{ message: string; user: any }> => {
    const response = await api.patch('/api/users/settings', settings);
    return response.data;
  },
  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await api.delete('/api/users/account');
    return response.data;
  },
};

export default api;
