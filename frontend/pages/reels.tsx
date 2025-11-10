import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import CreatePostModal from '../components/CreatePostModal';
import ReactionsBar from '../components/ReactionsBar';
import { postsAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getUser } from '../lib/auth';
import Image from 'next/image';
import Link from 'next/link';

export default function Reels() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState<{ [key: number]: boolean }>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUser = getUser();

  // Fetch reels (posts where is_reel = true)
  type ReelsPage = Awaited<ReturnType<typeof postsAPI.getReels>>;

  const {
    data: reelsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<ReelsPage, Error, ReelsPage, [string], string | undefined>({
    queryKey: ['reels'],
    queryFn: async ({ pageParam }) => {
      const result = await postsAPI.getReels({
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  const reelsPages =
    (reelsData as InfiniteData<ReelsPage, string | undefined> | undefined)?.pages ?? [];

  const reels = reelsPages.flatMap((page: ReelsPage) => page.posts ?? []);

  // Set up Socket.io for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();
    socket.emit('subscribe:posts');

    socket.on('post.new', (newPost: any) => {
      if (newPost.is_reel && newPost.module?.includes('visuals')) {
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

  // Handle video play/pause
  const togglePlay = (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (playing[index]) {
        video.pause();
      } else {
        video.play();
      }
      setPlaying({ ...playing, [index]: !playing[index] });
    }
  };

  // Auto-play current video when scrolled into view
  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (video && reels.length > 0) {
      video.play().catch(() => {
        // Autoplay blocked, user needs to interact
      });
      setPlaying({ ...playing, [currentIndex]: true });
    }
  }, [currentIndex]);

  // Handle scroll to load more
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Handle wheel/touch events for vertical scrolling between reels
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0 && currentIndex < reels.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (e.deltaY < 0 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Reels - Kartess">
        <div className="min-h-screen bg-black flex items-center justify-center pb-20">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  if (reels.length === 0) {
    return (
      <Layout title="Reels - Kartess">
        <div className="min-h-screen bg-black pb-20">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <p className="text-white text-xl mb-4">No reels yet</p>
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Your First Reel
              </Button>
            </div>
          </div>
        </div>
        <BottomNav />
        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            refetch();
            setIsCreateModalOpen(false);
          }}
          defaultModule="visuals"
          defaultIsReel={true}
        />
      </Layout>
    );
  }

  const currentReel = reels[currentIndex];

  return (
    <Layout title="Reels - Kartess">
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className="min-h-screen bg-black overflow-y-auto pb-20 snap-y snap-mandatory"
        style={{ height: '100vh' }}
      >
        {reels.map((reel: any, index: number) => {
          const mediaUrls = reel.media_urls || [];
          const videoUrl = mediaUrls.find((url: string) => url.includes('.mp4') || url.includes('.webm') || url.includes('video'));
          
          return (
            <div
              key={reel.id}
              className="h-screen snap-start flex items-center justify-center relative"
            >
              {/* Video */}
              {videoUrl ? (
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  loop
                  muted={index !== currentIndex}
                  playsInline
                  onClick={() => togglePlay(index)}
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <p className="text-white">No video available</p>
                </div>
              )}

              {/* Overlay with user info and actions */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex items-end justify-between">
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <Link href={`/${reel.user.username}/profile`}>
                      {reel.user.profile?.avatar_url ? (
                        <Image
                          src={reel.user.profile.avatar_url}
                          alt={reel.user.full_name}
                          width={48}
                          height={48}
                          className="rounded-full border-2 border-white"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                          {reel.user.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                    </Link>
                    <div>
                      <Link href={`/${reel.user.username}/profile`}>
                        <p className="text-white font-semibold">{reel.user.full_name}</p>
                      </Link>
                      {reel.content && (
                        <p className="text-white text-sm mt-1">{reel.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <ReactionsBar post={reel} variant="reel" />
                </div>
              </div>

              {/* Play/Pause Indicator */}
              {!playing[index] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => togglePlay(index)}
                    className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                  >
                    <span className="text-4xl text-white">▶️</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <BottomNav />
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsCreateModalOpen(false);
        }}
        defaultModule="visuals"
        defaultIsReel={true}
      />
    </Layout>
  );
}
