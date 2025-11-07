import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import PostCardExtended from '../../components/PostCardExtended';
import CreatePostModal from '../../components/CreatePostModal';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { postsAPI } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';

export default function ConnectFeed() {
  const router = useRouter();
  const { username } = router.query;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const currentUser = getUser();

  // Check if viewing own profile or other's
  const isOwnProfile = currentUser?.username === username;

  // Get user data if viewing other's profile
  const { data: userData } = useQuery({
    queryKey: ['userByUsername', username],
    queryFn: () => {
      if (!username || isOwnProfile) return null;
      return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/${username}`)
        .then((res) => {
          if (!res.ok) throw new Error('User not found');
          return res.json();
        });
    },
    enabled: !!username && !isOwnProfile,
  });

  const targetUser = isOwnProfile ? currentUser : userData;
  const targetUserId = targetUser?.id;

  // Fetch Connect module posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['connectPosts', targetUserId],
    queryFn: async ({ pageParam }) => {
      if (targetUserId) {
        // User-specific posts
        const result = await postsAPI.getUserPosts(targetUserId, {
          module: 'connect',
          cursor: pageParam,
          limit: 20,
        });
        return result;
      } else {
        // General Connect feed (friends' posts)
        const result = await postsAPI.getModulePosts('connect', {
          cursor: pageParam,
          limit: 20,
        });
        return result;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!targetUserId || isOwnProfile,
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  // Set up Socket.io for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();
    socket.emit('subscribe:posts');

    socket.on('post.new', (newPost: any) => {
      if (newPost.module?.includes('connect')) {
        refetch();
      }
    });

    socket.on('post.deleted', (deletedPost: any) => {
      if (deletedPost?.id) {
        refetch();
      }
    });

    socket.on('reaction.update', () => {
      refetch();
    });

    socket.on('comment.new', () => {
      refetch();
    });

    return () => {
      socket.emit('unsubscribe:posts');
      socket.off('post.new');
      socket.off('post.deleted');
      socket.off('reaction.update');
      socket.off('comment.new');
    };
  }, [refetch]);

  const handlePostSuccess = () => {
    refetch();
  };

  return (
    <Layout title={`${targetUser?.full_name || 'Connect'} - Connect`}>
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Connect</h1>
                {username && (
                  <p className="text-sm text-gray-500">
                    {isOwnProfile ? 'Your posts' : `${targetUser?.full_name}'s posts`}
                  </p>
                )}
              </div>
              {isOwnProfile && (
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 text-sm bg-blue-600"
                >
                  + Post
                </Button>
              )}
            </div>
          </div>

          {/* Feed */}
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No posts yet</p>
                {isOwnProfile && (
                  <Button
                    variant="primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600"
                  >
                    Create Your First Post
                  </Button>
                )}
              </div>
            ) : (
              <>
                {posts.map((post: any) => (
                  <PostCardExtended
                    key={post.id}
                    post={post}
                    onRepost={(postId) => {
                      // Handle repost - could open modal or direct repost
                      router.push(`/posts/${postId}/repost`);
                    }}
                  />
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
            onSuccess={handlePostSuccess}
          />
        )}
      </Layout>
  );
}
