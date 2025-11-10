import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import PostCard from '../components/PostCard';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { searchAPI } from '../lib/api';
import Image from 'next/image';
import Link from 'next/link';

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'users' | 'posts'>('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Get query from URL if present
  useEffect(() => {
    if (router.query.q) {
      setQuery(router.query.q as string);
      setDebouncedQuery(router.query.q as string);
    }
  }, [router.query.q]);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, searchType],
    queryFn: () => searchAPI.search(debouncedQuery, searchType),
    enabled: debouncedQuery.length > 0,
  });

  // Autocomplete for hashtags
  const { data: hashtagSuggestions } = useQuery({
    queryKey: ['autocomplete', 'hashtags', debouncedQuery],
    queryFn: () => searchAPI.autocomplete(debouncedQuery, 'hashtags'),
    enabled: debouncedQuery.length > 0 && debouncedQuery.startsWith('#'),
  });

  // Autocomplete for mentions
  const { data: mentionSuggestions } = useQuery({
    queryKey: ['autocomplete', 'mentions', debouncedQuery],
    queryFn: () => searchAPI.autocomplete(debouncedQuery.replace('@', ''), 'mentions'),
    enabled: debouncedQuery.length > 0 && debouncedQuery.startsWith('@'),
  });

  return (
    <Layout title="Search - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Search Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, posts, hashtags..."
              className="mb-3"
            />

            {/* Search Type Tabs */}
            <div className="flex gap-2">
              {(['all', 'users', 'posts'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSearchType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    searchType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Autocomplete Suggestions */}
            {(((hashtagSuggestions?.suggestions?.length ?? 0) > 0) ||
              ((mentionSuggestions?.suggestions?.length ?? 0) > 0)) && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {hashtagSuggestions?.suggestions?.map((suggestion: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(`#${suggestion.tag}`);
                      setDebouncedQuery(`#${suggestion.tag}`);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span className="text-blue-600">#{suggestion.tag}</span>
                    <span className="text-xs text-gray-500">{suggestion.count} posts</span>
                  </button>
                ))}
                {mentionSuggestions?.suggestions?.map((suggestion: any, idx: number) => (
                  <Link
                    key={idx}
                    href={`/${suggestion.username}/profile`}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                  >
                    {suggestion.avatar_url ? (
                      <Image
                        src={suggestion.avatar_url}
                        alt={suggestion.full_name}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        {suggestion.full_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{suggestion.full_name}</p>
                      <p className="text-xs text-gray-500">@{suggestion.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="px-4 py-4">
            {!debouncedQuery ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Start typing to search...</p>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                {/* Users Results */}
                {(searchType === 'all' || searchType === 'users') &&
                  data?.users &&
                  data.users.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">Users</h2>
                      <div className="space-y-3">
                        {data.users.map((user: any) => (
                          <Link
                            key={user.id}
                            href={`/${user.username}/profile`}
                            className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
                          >
                            {user.profile?.avatar_url ? (
                              <Image
                                src={user.profile.avatar_url}
                                alt={user.full_name}
                                width={48}
                                height={48}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                {user.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {user.full_name}
                              </p>
                              <p className="text-sm text-gray-500">@{user.username}</p>
                              {user.profile?.bio && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {user.profile.bio}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Posts Results */}
                {(searchType === 'all' || searchType === 'posts') &&
                  data?.posts &&
                  data.posts.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">Posts</h2>
                      <div className="space-y-4">
                        {data.posts.map((post: any) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  )}

                {/* Hashtags Results */}
                {searchType === 'all' &&
                  data?.hashtags &&
                  data.hashtags.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">Hashtags</h2>
                      <div className="flex flex-wrap gap-2">
                        {data.hashtags.map((hashtag: any, idx: number) => (
                          <Link
                            key={idx}
                            href={`/search?q=${encodeURIComponent(hashtag.tag)}`}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          >
                            #{hashtag.tag}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                {/* No Results */}
                {(!data ||
                  ((!data.users || data.users.length === 0) &&
                    (!data.posts || data.posts.length === 0) &&
                    (!data.hashtags || data.hashtags.length === 0))) && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No results found</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
