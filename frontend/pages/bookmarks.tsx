import { useInfiniteQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import PostCardExtended from '../components/PostCardExtended';
import { bookmarksAPI } from '../lib/api';
import Button from '../components/Button';

export default function Bookmarks() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const result = await bookmarksAPI.getBookmarks({
        cursor: pageParam,
        limit: 20,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
  });

  const bookmarks = data?.pages.flatMap((page) => page.bookmarks) || [];
  const posts = bookmarks.map((bookmark: any) => bookmark.post);

  return (
    <Layout title="Bookmarks - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Bookmarks</h1>
            <p className="text-sm text-gray-500 mt-1">Your saved posts</p>
          </div>

          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No bookmarks yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Save posts by clicking the bookmark icon
                </p>
              </div>
            ) : (
              <>
                {posts.map((post: any) => (
                  <PostCardExtended key={post.id} post={post} />
                ))}

                {hasNextPage && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? 'Loading more...' : 'Load More'}
                    </Button>
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
