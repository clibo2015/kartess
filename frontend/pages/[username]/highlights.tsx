import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { highlightsAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';
import Link from 'next/link';
import Image from 'next/image';

export default function StoryHighlights() {
  const router = useRouter();
  const { username } = router.query;
  const currentUser = getUser();
  const [isCreating, setIsCreating] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['highlights', username],
    queryFn: () => highlightsAPI.getHighlights(username as string),
    enabled: !!username,
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; story_ids: string[]; cover_url?: string }) =>
      highlightsAPI.createHighlight(data),
    onSuccess: () => {
      setIsCreating(false);
      setNewHighlightTitle('');
      queryClient.invalidateQueries({ queryKey: ['highlights', username] });
    },
  });

  const highlights = data?.highlights || [];
  const isOwnProfile = currentUser?.username === username;

  return (
    <Layout title={`${username}'s Highlights - Kartess`}>
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Story Highlights</h1>
              {isOwnProfile && (
                <Button
                  variant="primary"
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 text-sm"
                >
                  + New Highlight
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : highlights.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No highlights yet</p>
              {isOwnProfile && (
                <Button
                  variant="secondary"
                  onClick={() => setIsCreating(true)}
                  className="mt-2"
                >
                  Create Your First Highlight
                </Button>
              )}
            </div>
          ) : (
            <div className="px-4 py-4 grid grid-cols-2 gap-4">
              {highlights.map((highlight: any) => (
                <Link
                  key={highlight.id}
                  href={`/${username}/highlights/${highlight.id}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  {highlight.cover_url ? (
                    <Image
                      src={highlight.cover_url}
                      alt={highlight.title}
                      width={150}
                      height={150}
                      className="w-full aspect-square object-cover rounded-lg mb-2"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-2 flex items-center justify-center text-white text-2xl font-bold">
                      {highlight.title.charAt(0)}
                    </div>
                  )}
                  <p className="font-semibold text-gray-900 text-sm">{highlight.title}</p>
                  <p className="text-xs text-gray-500">
                    {highlight.stories?.length || 0} stories
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* Create Highlight Modal */}
          {isCreating && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create Highlight</h2>
                <input
                  type="text"
                  value={newHighlightTitle}
                  onChange={(e) => setNewHighlightTitle(e.target.value)}
                  placeholder="Highlight title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <p className="text-sm text-gray-500 mb-4">
                  Note: You can add stories to this highlight from your story archive.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsCreating(false);
                      setNewHighlightTitle('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (newHighlightTitle.trim()) {
                        createMutation.mutate({
                          title: newHighlightTitle.trim(),
                          story_ids: [], // User can add stories later
                        });
                      }
                    }}
                    disabled={!newHighlightTitle.trim() || createMutation.isPending}
                    className="flex-1"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <BottomNav />
      </Layout>
  );
}
