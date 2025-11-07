import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reactionsAPI, commentsAPI, postsAPI, bookmarksAPI } from '../lib/api';
import { getUser } from '../lib/auth';
import BookmarkButton from './BookmarkButton';
import CommentsModal from './CommentsModal';

interface ReactionsBarProps {
  post: {
    id: string;
    _count?: {
      reactions: number;
      comments: number;
    };
    reactions?: Array<{ type: string }>;
  };
  variant?: 'default' | 'compact' | 'reel';
  onRepost?: () => void;
}

const reactionEmojis: Record<string, string> = {
  like: '👍',
  love: '❤️',
  wow: '😮',
  sad: '😢',
  angry: '😠',
  endorse: '⭐',
};

export default function ReactionsBar({ post, variant = 'default', onRepost }: ReactionsBarProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = getUser();

  const userReaction = post.reactions?.[0]?.type;

  const reactionMutation = useMutation({
    mutationFn: (type: string) => reactionsAPI.react(post.id, type),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['connectPosts'] });
      queryClient.invalidateQueries({ queryKey: ['visualsPosts'] });
      queryClient.invalidateQueries({ queryKey: ['threadsPosts'] });
      queryClient.invalidateQueries({ queryKey: ['careernetPosts'] });
      queryClient.invalidateQueries({ queryKey: ['reels'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });

  const repostMutation = useMutation({
    mutationFn: () => postsAPI.repost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      if (onRepost) onRepost();
    },
  });

  const handleReaction = (type: string) => {
    reactionMutation.mutate(type);
    setShowReactionPicker(false);
  };

  const handleRepost = () => {
    if (confirm('Repost this post?')) {
      repostMutation.mutate();
    }
  };

  if (variant === 'reel') {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Like button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => handleReaction('love')}
            className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center transition-transform ${
              userReaction === 'love'
                ? 'bg-red-500/80 text-white scale-110'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span className="text-2xl">❤️</span>
          </button>
          <span className="text-white text-xs font-medium">
            {post._count?.reactions || 0}
          </span>
        </div>

        {/* Comments button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setShowComments(true)}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <span className="text-2xl">💬</span>
          </button>
          <span className="text-white text-xs font-medium">
            {post._count?.comments || 0}
          </span>
        </div>

        {/* Repost button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleRepost}
            disabled={repostMutation.isPending}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">🔄</span>
          </button>
        </div>

        {/* Share button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Check out this post on Kartess',
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }
            }}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <span className="text-2xl">📤</span>
          </button>
        </div>

        {/* Comments Modal */}
        {showComments && (
          <CommentsModal
            postId={post.id}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleReaction(userReaction === 'love' ? 'love' : 'love')}
          className={`flex items-center gap-1 transition-colors ${
            userReaction === 'love'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
          }`}
        >
          <span>❤️</span>
          <span className="text-sm">{post._count?.reactions || 0}</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <span>💬</span>
          <span className="text-sm">{post._count?.comments || 0}</span>
        </button>
        <button
          onClick={handleRepost}
          disabled={repostMutation.isPending}
          className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
        >
          <span>🔄</span>
        </button>
        <BookmarkButton postId={post.id} />
        {showComments && (
          <CommentsModal
            postId={post.id}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex items-center gap-4">
      {/* Reaction picker */}
      <div className="relative flex items-center gap-2">
        <button
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
          className={`flex items-center gap-1 transition-colors ${
            userReaction
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
          }`}
        >
          <span>{userReaction ? reactionEmojis[userReaction] : '❤️'}</span>
          <span className="text-sm">{post._count?.reactions || 0}</span>
        </button>

        {/* Reaction picker popup */}
        {showReactionPicker && (
          <div
            className="absolute bottom-full left-0 mb-2 flex gap-1 bg-white dark:bg-gray-800 rounded-full px-2 py-1 shadow-lg border border-gray-200 dark:border-gray-700 z-10"
            onMouseEnter={() => setShowReactionPicker(true)}
            onMouseLeave={() => setShowReactionPicker(false)}
          >
            {Object.entries(reactionEmojis).map(([type, emoji]) => (
              <button
                key={type}
                onClick={() => handleReaction(type)}
                className={`text-2xl hover:scale-125 transition-transform ${
                  userReaction === type ? 'scale-125' : ''
                }`}
                title={type}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comments */}
      <button
        onClick={() => setShowComments(true)}
        className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
      >
        <span>💬</span>
        <span className="text-sm">{post._count?.comments || 0}</span>
      </button>

      {/* Repost */}
      <button
        onClick={handleRepost}
        disabled={repostMutation.isPending}
        className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
      >
        <span>🔄</span>
      </button>

      {/* Bookmark */}
      <BookmarkButton postId={post.id} />

      {/* Comments Modal */}
      {showComments && (
        <CommentsModal
          postId={post.id}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

