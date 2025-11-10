import { useEffect, useState, useCallback } from 'react';
import { useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import PostCard from '../components/PostCard';
import dynamic from 'next/dynamic';

// Lazy load heavy modal components
const CreatePostModal = dynamic(() => import('../components/CreatePostModal'), {
  ssr: false,
});
const StoriesCarousel = dynamic(() => import('../components/StoriesCarousel'), {
  ssr: false,
});
const CreateStoryModal = dynamic(() => import('../components/CreateStoryModal'), {
  ssr: false,
});
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';
import { postsAPI, storiesAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getUser } from '../lib/auth';
import Image from 'next/image';
import Link from 'next/link';

const modules = [
  { key: 'all', label: 'All' },
  { key: 'connect', label: 'Connect' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'threads', label: 'Threads' },
  { key: 'careernet', label: 'Career' },
];
const sortOptions = ['chrono', 'algorithmic'];

export default function Home() {
  const [selectedModule, setSelectedModule] = useState('all');
  const [sortBy, setSortBy] = useState('chrono');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateStoryModalOpen, setIsCreateStoryModalOpen] = useState(false);
  const [selectedStoryUserId, setSelectedStoryUserId] = useState<string | undefined>(undefined);
  const [isStoryCarouselOpen, setIsStoryCarouselOpen] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const currentUser = getUser();

  // Fetch timeline with infinite scroll
  type TimelinePage = Awaited<ReturnType<typeof postsAPI.getTimeline>>;

  const {
    data: timelineData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<
    TimelinePage,
    Error,
    TimelinePage,
    [string, string, string],
    string | undefined
  >({
    queryKey: ['timeline', selectedModule, sortBy],
    queryFn: async ({ pageParam }) => {
      const result = await postsAPI.getTimeline({
        module: selectedModule !== 'all' ? selectedModule : undefined,
        sort: sortBy,
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  const timelinePages =
    (timelineData as InfiniteData<TimelinePage, string | undefined> | undefined)?.pages ?? [];

  const posts =
    timelinePages
      .flatMap((page: TimelinePage) => page.posts ?? [])
      ?.filter((post: any) => !post.is_reel) ?? [];

  // Fetch stories
  const { data: storiesData, refetch: refetchStories } = useQuery({
    queryKey: ['stories'],
    queryFn: () => storiesAPI.getStories(),
  });

  const stories = storiesData?.stories || [];

  const handlePostSuccess = () => {
    refetch();
    if (socket) {
      socket.emit('subscribe:posts');
    }
  };

  const handleStoryClick = (userId: string) => {
    setSelectedStoryUserId(userId);
    setIsStoryCarouselOpen(true);
  };

// Set up Socket.io connection
useEffect(() => {
  if (typeof window === 'undefined') return;

  const socketInstance = getSocket();
  setSocket(socketInstance);

  socketInstance.emit('subscribe:posts');

  const refreshTimeline = () => {
    refetch();
  };

  socketInstance.on('post.new', refreshTimeline);
  socketInstance.on('post.deleted', refreshTimeline);

  return () => {
    socketInstance.emit('unsubscribe:posts');
    socketInstance.off('post.new', refreshTimeline);
    socketInstance.off('post.deleted', refreshTimeline);
  };
}, [refetch]);

  return (
    <Layout title="Home - Kartess">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Logo size="sm" showText={false} onClick={() => {}} />
                <motion.h1
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <motion.span
                    animate={{
                      textShadow: [
                        '0 0 20px rgba(59, 130, 246, 0.5)',
                        '0 0 40px rgba(236, 72, 153, 0.5)',
                        '0 0 20px rgba(59, 130, 246, 0.5)',
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="bg-gradient-to-r from-blue-600 via-pink-600 to-green-600 bg-clip-text text-transparent"
                  >
                    Kartess
                  </motion.span>
                </motion.h1>
              </div>
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 text-sm"
              >
                + Create
              </Button>
            </div>

            {/* Module Filters */}
            <div className="relative -mx-4 px-4">
              <div 
                className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {modules.map((module) => (
                  <button
                    key={module.key}
                    onClick={() => setSelectedModule(module.key)}
                    className={`flex-shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap ${
                      selectedModule === module.key
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {module.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex gap-2 mt-2 min-w-0">
              {sortOptions.map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`flex-shrink-0 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs font-medium whitespace-nowrap ${
                    sortBy === sort
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {sort === 'chrono' ? 'Chronological' : 'Popular'}
                </button>
              ))}
            </div>
          </div>

          {/* Stories Section */}
          {stories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
              <div 
                className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {/* Create Story Button */}
                <button
                  onClick={() => setIsCreateStoryModalOpen(true)}
                  className="flex flex-col items-center gap-2 flex-shrink-0"
                >
                  <div className="relative w-16 h-16">
                    <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500 p-1">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-700 flex items-center justify-center">
                        {currentUser?.profile?.avatar_url ? (
                          <Image
                            src={currentUser.profile.avatar_url}
                            alt={currentUser.full_name || 'You'}
                            width={56}
                            height={56}
                            className="rounded-full"
                          />
                        ) : (
                          <span className="text-xl font-bold text-gray-600">
                            {currentUser?.full_name?.charAt(0) || '+'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-lg border-2 border-white">
                      +
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Your Story</p>
                </button>

                {/* Other Users' Stories */}
                {stories.slice(0, 10).map((storyGroup: any) => {
                  const user = storyGroup.user;
                  const storyCount = storyGroup.stories?.length || 0;
                  const latestStory = storyGroup.stories?.[0];
                  const mediaUrl = latestStory?.media_urls?.[0];

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleStoryClick(user.id)}
                      className="flex flex-col items-center gap-2 flex-shrink-0"
                    >
                      <div className="relative w-16 h-16">
                        {mediaUrl ? (
                          <Image
                            src={mediaUrl}
                            alt={user.full_name}
                            width={64}
                            height={64}
                            className="rounded-full object-cover border-4 border-gradient-to-r from-blue-500 via-pink-500 to-yellow-500"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500 p-1">
                            <div className="w-full h-full rounded-full bg-white dark:bg-gray-700 flex items-center justify-center">
                              {user.profile?.avatar_url ? (
                                <Image
                                  src={user.profile.avatar_url}
                                  alt={user.full_name}
                                  width={56}
                                  height={56}
                                  className="rounded-full"
                                />
                              ) : (
                                <span className="text-xl font-bold text-gray-600">
                                  {user.full_name?.charAt(0) || '?'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {storyCount > 1 && (
                          <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {storyCount}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 text-center max-w-[64px] truncate">
                        {user.full_name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No posts yet</p>
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create Your First Post
                </Button>
              </div>
            ) : (
              <>
                {posts.map((post: any) => (
                  <PostCard key={post.id} post={post} />
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

        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handlePostSuccess}
        />

        <CreateStoryModal
          isOpen={isCreateStoryModalOpen}
          onClose={() => setIsCreateStoryModalOpen(false)}
          onSuccess={() => {
            refetchStories();
            setIsCreateStoryModalOpen(false);
          }}
        />

        <StoriesCarousel
          isOpen={isStoryCarouselOpen}
          onClose={() => {
            setIsStoryCarouselOpen(false);
            setSelectedStoryUserId(undefined);
          }}
          initialUserId={selectedStoryUserId}
        />
      </Layout>
  );
}
