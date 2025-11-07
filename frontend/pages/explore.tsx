import { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Masonry from 'react-masonry-css';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';
import { postsAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import Image from 'next/image';
import Link from 'next/link';

export default function Explore() {
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Get popular public visuals (ordered by engagement)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['exploreVisuals'],
    queryFn: async ({ pageParam }) => {
      const result = await postsAPI.getTimeline({
        module: 'visuals',
        sort: 'algorithmic', // Popular/algorithmic feed
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

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
    default: 4,
    1200: 3,
    800: 2,
    500: 1,
  };

  return (
    <Layout title="Explore - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-6">
            <div className="flex items-center gap-3 mb-2">
              <Logo size="sm" showText={false} onClick={() => {}} />
              <h1 className="text-2xl font-bold text-gray-900">Explore</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Discover popular visual content
            </p>
          </div>

          {/* Masonry Grid */}
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No content to explore yet</p>
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
                      className="mb-4 bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
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
                              alt={post.content || 'Visual'}
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
                      <div className="p-2">
                        <div className="flex items-center gap-2 mb-1">
                          {post.user.profile?.avatar_url ? (
                            <Image
                              src={post.user.profile.avatar_url}
                              alt={post.user.full_name}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                              {post.user.full_name.charAt(0)}
                            </div>
                          )}
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {post.user.full_name}
                          </p>
                        </div>
                        {post.content && (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {post.content}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>❤️ {post._count?.reactions || 0}</span>
                          <span>💬 {post._count?.comments || 0}</span>
                        </div>
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
                <Link
                  href={`/${selectedPost.user.username}/visuals`}
                  className="flex items-center gap-3"
                >
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
                    <p className="font-semibold text-gray-900">
                      {selectedPost.user.full_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      @{selectedPost.user.username}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
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
                  <p className="text-gray-900 mb-4 whitespace-pre-wrap">
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

                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <span className="text-gray-600">
                    ❤️ {selectedPost._count?.reactions || 0}
                  </span>
                  <span className="text-gray-600">
                    💬 {selectedPost._count?.comments || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <BottomNav />
      </Layout>
  );
}
