import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import CreatePostModal from '../../components/CreatePostModal';
import PostCard from '../../components/PostCard';
import { careernetAPI, postsAPI, contactsAPI } from '../../lib/api';
import { useRouter } from 'next/router';
import { getUser } from '../../lib/auth';
import { getSocket } from '../../lib/socket';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type TabType = 'feed' | 'network' | 'jobs';

export default function CareerNet() {
  const router = useRouter();
  const currentUser = getUser();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState('');

  // Fetch professional posts feed (careernet module)
  const {
    data: feedData,
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: hasNextFeedPage,
    isFetchingNextPage: isFetchingNextFeedPage,
    isLoading: isLoadingFeed,
    refetch: refetchFeed,
  } = useInfiniteQuery({
    queryKey: ['careernetFeed'],
    queryFn: async ({ pageParam }) => {
      const result = await postsAPI.getModulePosts('careernet', {
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: activeTab === 'feed',
  });

  const feedPosts = feedData?.pages.flatMap((page) => page.posts) || [];

  // Set up Socket.io for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || activeTab !== 'feed') return;

    const socket = getSocket();
    socket.emit('subscribe:posts');

    socket.on('post.new', (newPost: any) => {
      if (newPost.module?.includes('careernet')) {
        refetchFeed();
      }
    });

    socket.on('post.deleted', (deletedPost: any) => {
      if (deletedPost?.id) {
        refetchFeed();
      }
    });

    return () => {
      socket.emit('unsubscribe:posts');
      socket.off('post.new');
      socket.off('post.deleted');
    };
  }, [activeTab, refetchFeed]);

  // Fetch professional network contacts
  const {
    data: networkData,
    isLoading: isLoadingNetwork,
    refetch: refetchNetwork,
  } = useQuery({
    queryKey: ['careernetNetwork'],
    queryFn: () => contactsAPI.getContacts(),
    enabled: activeTab === 'network',
  });

  const allContacts = networkData?.contacts || [];
  // Filter for professional network contacts (contacts with professional preset)
  const professionalContacts = allContacts.filter((contact: any) => {
    const isSender = contact.sender_id === currentUser?.id;
    const otherUser = isSender ? contact.receiver : contact.sender;
    // Check if contact has professional preset (either sender or receiver preset is professional)
    return (
      contact.sender_preset === 'professional' ||
      contact.receiver_preset === 'professional' ||
      contact.sender_preset === 'custom' ||
      contact.receiver_preset === 'custom'
    );
  });

  // Fetch jobs
  const {
    data: jobsData,
    fetchNextPage: fetchNextJobsPage,
    hasNextPage: hasNextJobsPage,
    isFetchingNextPage: isFetchingNextJobsPage,
    isLoading: isLoadingJobs,
  } = useInfiniteQuery({
    queryKey: ['careernetJobs', searchQuery, typeFilter, locationFilter],
    queryFn: async ({ pageParam }) => {
      const result = await careernetAPI.getJobs({
        status: 'open',
        type: typeFilter,
        location: locationFilter || undefined,
        search: searchQuery || undefined,
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: activeTab === 'jobs',
  });

  const jobs = jobsData?.pages.flatMap((page) => page.jobs) || [];
  const jobTypes = ['full-time', 'part-time', 'contract', 'internship'];

  const handlePostSuccess = () => {
    refetchFeed();
    setIsCreateModalOpen(false);
  };

  return (
    <Layout title="CareerNet - Kartess">
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-purple-600">CareerNet</h1>
            {activeTab === 'feed' && (
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 text-sm bg-purple-600"
              >
                + Post
              </Button>
            )}
            {activeTab === 'jobs' && (
              <Button
                variant="primary"
                onClick={() => router.push('/careernet/jobs/new')}
                className="px-4 py-2 text-sm bg-purple-600"
              >
                + Post Job
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 -mx-4 px-4">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'feed'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Feed
              {activeTab === 'feed' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'network'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Network
              {activeTab === 'network' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'jobs'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Jobs
              {activeTab === 'jobs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>
        </div>

        {/* Feed Tab */}
        {activeTab === 'feed' && (
          <div className="px-4 py-4">
            {isLoadingFeed ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : feedPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No professional posts yet</p>
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-purple-600"
                >
                  Share Your First Post
                </Button>
              </div>
            ) : (
              <>
                {feedPosts.map((post: any) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {hasNextFeedPage && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => fetchNextFeedPage()}
                      loading={isFetchingNextFeedPage}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="px-4 py-4">
            {isLoadingNetwork ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : professionalContacts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No professional connections yet</p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/contacts')}
                  className="bg-purple-600"
                >
                  Connect with Professionals
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {professionalContacts.map((contact: any) => {
                  const isSender = contact.sender_id === currentUser?.id;
                  const otherUser = isSender ? contact.receiver : contact.sender;

                  return (
                    <Link
                      key={contact.id}
                      href={`/${otherUser.username}/profile`}
                      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        {otherUser.profile?.avatar_url ? (
                          <Image
                            src={otherUser.profile.avatar_url}
                            alt={otherUser.full_name}
                            width={48}
                            height={48}
                            className="rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {otherUser.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">{otherUser.full_name}</h3>
                          {otherUser.profile?.company && (
                            <p className="text-sm text-gray-600">{otherUser.profile.company}</p>
                          )}
                          {otherUser.profile?.position && (
                            <p className="text-sm text-gray-500">{otherUser.profile.position}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <>
            {/* Search and Filters */}
            <div className="px-4 py-4 border-b border-gray-200 bg-white">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              />

              {/* Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setTypeFilter(undefined)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    !typeFilter
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All Types
                </button>
                {jobTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap capitalize ${
                      typeFilter === type
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {type.replace('-', ' ')}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Filter by location..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
              />
            </div>

            {/* Jobs List */}
            <div className="px-4 py-4">
              {isLoadingJobs ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No jobs found</p>
                  <Button
                    variant="primary"
                    onClick={() => router.push('/careernet/jobs/new')}
                    className="bg-purple-600"
                  >
                    Post First Job
                  </Button>
                </div>
              ) : (
                <>
                  {jobs.map((job: any) => (
                    <Link
                      key={job.id}
                      href={`/careernet/jobs/${job.id}`}
                      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        {job.user.profile?.avatar_url ? (
                          <Image
                            src={job.user.profile.avatar_url}
                            alt={job.user.full_name}
                            width={48}
                            height={48}
                            className="rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {job.user.full_name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
                            {job.status === 'open' && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                Open
                              </span>
                            )}
                          </div>
                          {job.company && (
                            <p className="text-gray-700 font-medium mb-1">{job.company}</p>
                          )}
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {job.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {job.type && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded capitalize">
                                {job.type.replace('-', ' ')}
                              </span>
                            )}
                            {job.location && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                📍 {job.location}
                              </span>
                            )}
                            {job.salary_range && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                💰 {job.salary_range}
                              </span>
                            )}
                          </div>
                          {(job.tags as string[])?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(job.tags as string[]).slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                            <span>📄 {job._count?.applications || 0} applications</span>
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {hasNextJobsPage && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="secondary"
                        onClick={() => fetchNextJobsPage()}
                        loading={isFetchingNextJobsPage}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePostSuccess}
        defaultModule="careernet"
      />
    </Layout>
  );
}
