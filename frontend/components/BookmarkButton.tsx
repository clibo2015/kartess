import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookmarksAPI } from '../lib/api';

interface BookmarkButtonProps {
  postId: string;
}

export default function BookmarkButton({ postId }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['bookmarkCheck', postId],
    queryFn: () => bookmarksAPI.checkBookmarked(postId),
  });

  useEffect(() => {
    if (data) {
      setBookmarked(data.bookmarked);
    }
  }, [data]);

  const bookmarkMutation = useMutation({
    mutationFn: () => (bookmarked ? bookmarksAPI.unbookmark(postId) : bookmarksAPI.bookmark(postId)),
    onSuccess: () => {
      setBookmarked(!bookmarked);
      queryClient.invalidateQueries({ queryKey: ['bookmarkCheck', postId] });
    },
  });

  return (
    <button
      onClick={() => bookmarkMutation.mutate()}
      disabled={bookmarkMutation.isPending}
      className={`text-sm ${
        bookmarked ? 'text-yellow-600' : 'text-gray-500 hover:text-yellow-600'
      }`}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
    >
      {bookmarked ? '🔖' : '🔖'}
    </button>
  );
}
