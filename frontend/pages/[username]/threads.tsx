import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import PostCardExtended from '../../components/PostCardExtended';
import CreatePostModal from '../../components/CreatePostModal';
import { postsAPI, threadsAPI } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import Link from 'next/link';
import Image from 'next/image';

export default function ThreadsFeed() {
  const router = useRouter();
  const { username } = router.query;
  const [viewMode, setViewMode] = useState<'posts' | 'discussions'>('posts');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('recent');
  const currentUser = getUser();

  const isOwnProfile = currentUser?.username === username;

  const { data: userData } = useQuery({
    queryKey: ['userByUsername', username],
    queryFn: () => {
      if (!username || isOwnProfile) return null;
      return fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/${username}`
      ).then((res) => {
        if (!res.ok) throw new Error('User not found');
        return res.json();
      });
    },
    enabled: !!username && !isOwnProfile,
  });

  const targetUser = isOwnProfile ? currentUser : userData;
  const targetUserId = targetUser?.id;

  const { data: topicsData } = useQuery({
    queryKey: ['threadTopics'],
    queryFn: () => threadsAPI.getTopics(),
    enabled: viewMode === 'discussions',
  });

  const {
    data: postsData,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasNextPosts,
    isFetchingNextPage: isFetchingNextPosts,
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useInfiniteQuery({
    queryKey: ['threadPosts', targetUserId, viewMode],
    queryFn: async ({ pageParam }) => {
      const params = {
        cursor: pageParam,
        limit: 20,
      };

      if (targetUserId) {
        return postsAPI.getUserPosts(targetUserId, { module: 'threads', ...params });
      }

      return postsAPI.getModulePosts('threads', params);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: viewMode === 'posts' && (isOwnProfile ? true : Boolean(targetUserId)),
  });

  const threadPosts =
    postsData?.pages
      .flatMap((page) => page.posts)
      .filter((post: any) => {
        const modules = typeof post.module === 'string'
          ? post.module.split(',').map((mod: string) => mod.trim().toLowerCase())
          : [];
        return modules.includes('threads');
      }) || [];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['threads', selectedTopic, sortBy],
    queryFn: async ({ pageParam }) => {
      const result = await threadsAPI.getThreads({
        topic: selectedTopic || undefined,
        sort: sortBy,
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: viewMode === 'discussions',
  });

  const threads = data?.pages.flatMap((page) => page.threads) || [];

  // Set up Socket.io for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || viewMode !== 'posts') return;

    const socket = getSocket();
    socket.emit('subscribe:posts');

    const handleNewPost = (newPost: any) => {
      if (newPost.module?.includes('threads')) {
        refetchPosts();
      }
    };

    const handleDeletedPost = (deletedPost: any) => {
      if (deletedPost?.id) {
        refetchPosts();
      }
    };

    socket.on('post.new', handleNewPost);
    socket.on('post.deleted', handleDeletedPost);

    return () => {
      socket.emit('unsubscribe:posts');
      socket.off('post.new', handleNewPost);
      socket.off('post.deleted', handleDeletedPost);
    };
  }, [refetchPosts, viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || viewMode !== 'discussions') return;

    const socket = getSocket();
    socket.on('thread.reply.new', () => {
      refetch();
    });

    return () => {
      socket.off('thread.reply.new');
    };
  }, [refetch, viewMode]);

  return (
    <Layout title="Threads - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold text-green-600">Threads</h1>
              {viewMode === 'posts' ? (
                isOwnProfile && (
                  <Button
                    variant="primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 text-sm bg-green-600"
                  >
                    + Post
                  </Button>
                )
              ) : (
                isOwnProfile && (
                  <Button
                    variant="primary"
                    onClick={() => router.push('/threads/new')}
                    className="px-4 py-2 text-sm bg-green-600"
                  >
                    + New Thread
                  </Button>
                )
              )}
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setViewMode('posts')}
                className={`px-3 py-1 rounded-full text-sm ${
                  viewMode === 'posts'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Posts
              </button>
              <button
                onClick={() => setViewMode('discussions')}
                className={`px-3 py-1 rounded-full text-sm ${
                  viewMode === 'discussions'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Discussions
              </button>
            </div>

            {viewMode === 'discussions' && topicsData?.topics && topicsData.topics.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    !selectedTopic
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All
                </button>
                {topicsData.topics.map((topic: any) => (
                  <button
                    key={topic.name}
                    onClick={() => setSelectedTopic(topic.name)}
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                      selectedTopic === topic.name
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {topic.name} ({topic.count})
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'discussions' && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-3 py-1 rounded text-sm ${
                    sortBy === 'recent'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Recent
                </button>
                <button
                  onClick={() => setSortBy('popular')}
                  className={`px-3 py-1 rounded text-sm ${
                    sortBy === 'popular'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Popular
                </button>
                <button
                  onClick={() => setSortBy('pinned')}
                  className={`px-3 py-1 rounded text-sm ${
                    sortBy === 'pinned'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Pinned
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            {viewMode === 'posts' ? (
              postsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : threadPosts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No posts tagged with Threads yet</p>
                  {isOwnProfile && (
                    <Button
                      variant="primary"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-green-600"
                    >
                      Create Your First Thread Post
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {threadPosts.map((post: any) => (
                    <PostCardExtended
                      key={post.id}
                      post={post}
                      onRepost={(postId) => router.push(`/posts/${postId}/repost`)}
                    />
                  ))}

                  {hasNextPosts && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="secondary"
                        onClick={() => fetchNextPosts()}
                        loading={isFetchingNextPosts}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </>
              )
            ) : isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No discussions yet</p>
                {isOwnProfile && (
                  <Button
                    variant="primary"
                    onClick={() => router.push('/threads/new')}
                    className="bg-green-600"
                  >
                    Create Your First Thread
                  </Button>
                )}
              </div>
            ) : (
              <>
                {threads.map((thread: any) => (
                  <Link
                    key={thread.id}
                    href={`/threads/${thread.id}`}
                    className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      {thread.user.profile?.avatar_url ? (
                        <Image
                          src={thread.user.profile.avatar_url}
                          alt={thread.user.full_name}
                          width={40}
                          height={40}
                          className="rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {thread.user.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {thread.user.full_name}
                          </p>
                          {thread.pinned && (
                            <span className="text-green-600 text-xs">📌</span>
                          )}
                          {thread.locked && (
                            <span className="text-gray-500 text-xs">🔒</span>
                          )}
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">{thread.title}</h3>
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                          {thread.content}
                        </p>
                        {thread.topic && (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded mb-2">
                            {thread.topic}
                          </span>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>👁️ {thread.views_count} views</span>
                          <span>💬 {thread.replies_count} replies</span>
                          <span>
                            {new Date(thread.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {hasNextPage && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => fetchNextPage()}
                      loading={isFetchingNextPage}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <BottomNav />

        {isOwnProfile && (
          <CreatePostModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              refetchPosts();
              setIsCreateModalOpen(false);
            }}
            defaultModule="threads"
          />
        )}
      </Layout>
  );
}
