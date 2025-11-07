import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { storiesAPI } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';

interface StoriesCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string;
}

export default function StoriesCarousel({
  isOpen,
  onClose,
  initialUserId,
}: StoriesCarouselProps) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: () => storiesAPI.getStories(),
    enabled: isOpen,
  });

  const stories = storiesData?.stories || [];

  useEffect(() => {
    if (!isOpen || stories.length === 0) return;

    // Find initial user index if userId provided
    if (initialUserId) {
      const userIndex = stories.findIndex(
        (s: any) => s.user.id === initialUserId
      );
      if (userIndex >= 0) {
        setCurrentUserIndex(userIndex);
        setCurrentStoryIndex(0);
      }
    }

    // Auto-advance story progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Move to next story
          const currentUserStories = stories[currentUserIndex]?.stories || [];
          if (currentStoryIndex < currentUserStories.length - 1) {
            setCurrentStoryIndex((idx) => idx + 1);
            return 0;
          } else {
            // Move to next user
            if (currentUserIndex < stories.length - 1) {
              setCurrentUserIndex((idx) => idx + 1);
              setCurrentStoryIndex(0);
              return 0;
            } else {
              // All stories viewed
              onClose();
              return 0;
            }
          }
        }
        return prev + 1;
      });
    }, 50); // 5 seconds per story (100 * 50ms)

    return () => clearInterval(interval);
  }, [isOpen, stories, currentUserIndex, currentStoryIndex, onClose, initialUserId]);

  if (!isOpen || stories.length === 0) return null;

  const currentUserStories = stories[currentUserIndex]?.stories || [];
  const currentStory = currentUserStories[currentStoryIndex];

  if (!currentStory) {
    onClose();
    return null;
  }

  const mediaUrl = (currentStory.media_urls as string[])?.[0];

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
        <div
          className="h-full bg-white transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Story Content */}
      <div className="relative w-full h-full flex items-center justify-center">
        {mediaUrl ? (
          mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={mediaUrl}
              autoPlay
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <Image
              src={mediaUrl}
              alt="Story"
              fill
              className="object-contain"
            />
          )
        ) : (
          <div className="text-white text-center">
            <p>No media</p>
          </div>
        )}

        {/* Story Info */}
        <div className="absolute top-4 left-4 right-4 flex items-center gap-3">
          {stories[currentUserIndex]?.user?.profile?.avatar_url ? (
            <Image
              src={stories[currentUserIndex].user.profile.avatar_url}
              alt={stories[currentUserIndex].user.full_name}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              {stories[currentUserIndex]?.user?.full_name?.charAt(0)}
            </div>
          )}
          <div className="text-white">
            <p className="font-semibold">
              {stories[currentUserIndex]?.user?.full_name}
            </p>
            <p className="text-sm opacity-75">
              {new Date(currentStory.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <button
          onClick={() => {
            if (currentStoryIndex > 0) {
              setCurrentStoryIndex((idx) => idx - 1);
              setProgress(0);
            } else if (currentUserIndex > 0) {
              const prevUserStories = stories[currentUserIndex - 1]?.stories || [];
              setCurrentUserIndex((idx) => idx - 1);
              setCurrentStoryIndex(prevUserStories.length - 1);
              setProgress(0);
            }
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:bg-white hover:bg-opacity-20 rounded-full w-12 h-12 flex items-center justify-center"
        >
          ‹
        </button>

        <button
          onClick={() => {
            if (currentStoryIndex < currentUserStories.length - 1) {
              setCurrentStoryIndex((idx) => idx + 1);
              setProgress(0);
            } else if (currentUserIndex < stories.length - 1) {
              setCurrentUserIndex((idx) => idx + 1);
              setCurrentStoryIndex(0);
              setProgress(0);
            } else {
              onClose();
            }
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:bg-white hover:bg-opacity-20 rounded-full w-12 h-12 flex items-center justify-center"
        >
          ›
        </button>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:bg-white hover:bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Story dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {currentUserStories.map((_: any, idx: number) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all ${
              idx === currentStoryIndex ? 'bg-white w-8' : 'bg-gray-600 w-1'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
