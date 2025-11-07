import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import StoriesCarousel from '../components/StoriesCarousel';
import CreateStoryModal from '../components/CreateStoryModal';
import { storiesAPI } from '../lib/api';
import { getUser } from '../lib/auth';
import Image from 'next/image';
import Link from 'next/link';

export default function Stories() {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const currentUser = getUser();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stories'],
    queryFn: () => storiesAPI.getStories(),
  });

  const stories = data?.stories || [];

  const handleStoryClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsCarouselOpen(true);
  };

  if (isLoading) {
    return (
      <Layout title="Stories - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout title="Stories - Kartess">
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Stories</h1>
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 text-sm"
            >
              + Create Story
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            Stories disappear after 24 hours
          </p>
        </div>

        {/* Stories Grid */}
        <div className="px-4 py-6">
          {stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No stories yet</p>
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Your First Story
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {stories.map((storyGroup: any) => {
                const user = storyGroup.user;
                const storyCount = storyGroup.stories?.length || 0;
                const latestStory = storyGroup.stories?.[0];
                const mediaUrl = latestStory?.media_urls?.[0];

                return (
                  <button
                    key={user.id}
                    onClick={() => handleStoryClick(user.id)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="relative w-20 h-20">
                      {mediaUrl ? (
                        <Image
                          src={mediaUrl}
                          alt={user.full_name}
                          fill
                          className="rounded-full object-cover border-4 border-gradient-to-r from-blue-500 via-pink-500 to-yellow-500"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500 p-1">
                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                            {user.profile?.avatar_url ? (
                              <Image
                                src={user.profile.avatar_url}
                                alt={user.full_name}
                                width={72}
                                height={72}
                                className="rounded-full"
                              />
                            ) : (
                              <span className="text-2xl font-bold text-gray-600">
                                {user.full_name?.charAt(0) || '?'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {storyCount > 1 && (
                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                          {storyCount}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 text-center max-w-[80px] truncate">
                      {user.full_name}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      <StoriesCarousel
        isOpen={isCarouselOpen}
        onClose={() => {
          setIsCarouselOpen(false);
          setSelectedUserId(undefined);
        }}
        initialUserId={selectedUserId}
      />

      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsCreateModalOpen(false);
        }}
      />
    </Layout>
  );
}
