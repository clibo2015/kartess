import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Masonry from 'react-masonry-css';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import CreatePostModal from '../../components/CreatePostModal';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReactionsBar from '../../components/ReactionsBar';
import { postsAPI } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import Image from 'next/image';
import Link from 'next/link';

export default function VisualsFeed() {
  const router = useRouter();
  const { username } = router.query;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'reels'>('grid');
  const currentUser = getUser();

  const isOwnProfile = currentUser?.username === username;

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

  // Fetch Visuals module posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['visualsPosts', targetUserId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (targetUserId) {
        const result = await postsAPI.getUserPosts(targetUserId, {
          module: 'visuals',
          cursor: pageParam,
          limit: 20,
        });
        return result;
      } else {
        const result = await postsAPI.getModulePosts('visuals', {
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

  const allPosts = data?.pages.flatMap((page) => page.posts) || [];
  const posts = viewMode === 'grid' 
    ? allPosts.filter((p: any) => !p.is_reel)
    : allPosts.filter((p: any) => p.is_reel);

  // Set up Socket.io
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();
    socket.emit('subscribe:posts');

    socket.on('post.new', (newPost: any) => {
      if (newPost.module?.includes('visuals')) {
        refetch();
      }
    });

    socket.on('post.deleted', (deletedPost: any) => {
      if (deletedPost?.id) {
        refetch();
      }
    });

    return () => {
      socket.emit('unsubscribe:posts');
      socket.off('post.new');
      socket.off('post.deleted');
    };
  }, [refetch]);

  const breakpointColumnsObj = {
    default: 3,
    1100: 3,
    700: 2,
    500: 1,
  };

  return (
    <Layout title={`${targetUser?.full_name || 'Visuals'} - Visuals`}>
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold text-pink-600">Visuals</h1>
                {username && (
                  <p className="text-sm text-gray-500">
                    {isOwnProfile ? 'Your visuals' : `${targetUser?.full_name}'s visuals`}
                  </p>
                )}
              </div>
              {isOwnProfile && (
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 text-sm bg-pink-600"
                >
                  + Post
                </Button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('reels')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'reels'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Reels
              </button>
            </div>
          </div>

          {/* Masonry Grid */}
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No visuals yet</p>
                {isOwnProfile && (
                  <Button
                    variant="primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-pink-600"
                  >
                    Share Your First Visual
                  </Button>
                )}
              </div>
            ) : viewMode === 'reels' ? (
              <div className="space-y-4">
                {posts.map((post: any) => {
                  const mediaUrls = (post.media_urls as string[]) || [];
                  const videoUrl = mediaUrls.find((url: string) => 
                    url.includes('.mp4') || url.includes('.webm') || url.includes('video')
                  );

                  return (
                    <div
                      key={post.id}
                      className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          className="w-full max-h-[600px] object-contain"
                          controls
                          playsInline
                        />
                      ) : (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                          <p className="text-gray-500">No video available</p>
                        </div>
                      )}
                      {post.content && (
                        <div className="p-4">
                          <p className="text-sm text-gray-700">{post.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="masonry-grid"
                columnClassName="masonry-grid_column"
              >
                {posts.map((post: any) => {
                  const mediaUrls = (post.media_urls as string[]) || [];
                  const firstMedia = mediaUrls[0];

                  return (
                    <div
                      key={post.id}
                      className="mb-4 bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      {firstMedia && (
                        <div className="relative aspect-square">
                          {firstMedia.match(/\.(mp4|webm|mov)$/i) ? (
                            <video
                              src={firstMedia}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <Image
                              src={firstMedia}
                              alt={post.content}
                              fill
                              className="object-cover"
                            />
                          )}
                          {mediaUrls.length > 1 && (
                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                              {mediaUrls.length}
                            </div>
                          )}
                        </div>
                      )}
                      {post.content && (
                        <div className="p-2">
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {post.content}
                          </p>
                        </div>
                      )}
                      <div className="px-2 pb-2">
                        <ReactionsBar post={post} variant="compact" />
                      </div>
                    </div>
                  );
                })}
              </Masonry>
            )}

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
          </div>
        </div>

        {/* Full Post Modal */}
        {selectedPost && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}
          >
            <div
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {selectedPost.user.profile?.avatar_url ? (
                    <Image
                      src={selectedPost.user.profile.avatar_url}
                      alt={selectedPost.user.full_name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {selectedPost.user.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedPost.user.full_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      @{selectedPost.user.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {(selectedPost.media_urls as string[])?.map((url, idx) => (
                  <div key={idx} className="mb-4">
                    {url.match(/\.(mp4|webm|mov)$/i) ? (
                      <video src={url} controls className="w-full rounded-lg" />
                    ) : (
                      <Image
                        src={url}
                        alt={`Visual ${idx + 1}`}
                        width={800}
                        height={600}
                        className="w-full rounded-lg"
                      />
                    )}
                  </div>
                ))}

                {selectedPost.content && (
                  <p className="text-gray-900 dark:text-gray-100 mb-4 whitespace-pre-wrap">
                    {selectedPost.content}
                  </p>
                )}

                {(selectedPost.tags as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(selectedPost.tags as string[]).map((tag, idx) => (
                      <Link
                        key={idx}
                        href={`/search?q=${encodeURIComponent(tag)}`}
                        className="text-pink-600 hover:text-pink-700 text-sm"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <ReactionsBar post={selectedPost} variant="default" />
                </div>
              </div>
            </div>
          </div>
        )}

        <BottomNav />

        {isOwnProfile && (
          <CreatePostModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              refetch();
            }}
          />
        )}
      </Layout>
  );
}
