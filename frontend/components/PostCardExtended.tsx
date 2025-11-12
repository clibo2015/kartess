import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactionsBar from './ReactionsBar';
import PollComponent from './PollComponent';
import ConfirmModal from './ConfirmModal';
import { postsAPI } from '../lib/api';
import { getUser } from '../lib/auth';

interface PostCardExtendedProps {
  post: {
    id: string;
    content: string;
    module: string;
    media_urls?: string[] | null;
    tags?: string[] | null;
    created_at: string;
    user: {
      id: string;
      username: string;
      full_name: string;
      profile?: {
        avatar_url?: string | null;
      } | null;
    };
    _count?: {
      reactions: number;
      comments: number;
    };
    reactions?: Array<{ type: string }>;
    parent?: {
      id: string;
      content: string;
      media_urls?: string[] | null;
      tags?: string[] | null;
      created_at: string;
      user: {
        id: string;
        username: string;
        full_name: string;
        profile?: {
          avatar_url?: string | null;
        } | null;
      };
      _count?: {
        reactions: number;
        comments: number;
      };
      is_poll?: boolean;
    } | null;
    is_poll?: boolean;
  };
  onRepost?: (postId: string) => void;
}

const reactionEmojis: Record<string, string> = {
  like: '👍',
  love: '❤️',
  wow: '😮',
  sad: '😢',
  angry: '😠',
  endorse: '⭐',
};

export default function PostCardExtended({ post, onRepost }: PostCardExtendedProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const isOwner = currentUser?.id === post.user.id;
  const isRepost = !!post.parent;

  const deleteMutation = useMutation({
    mutationFn: () => postsAPI.delete(post.id),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['connectPosts'] });
      queryClient.invalidateQueries({ queryKey: ['visualsPosts'] });
      queryClient.invalidateQueries({ queryKey: ['threadPosts'] });
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || 'Failed to delete post');
    },
  });

  // For reposts: show parent post's media and tags, but repost author's comment
  // For regular posts: show post's own media and tags
  const displayPost = isRepost && post.parent ? post.parent : post;
  const mediaUrls = (displayPost.media_urls as string[]) || [];
  const tags = (displayPost.tags as string[]) || [];
  const displayContent = displayPost.content;

  const moduleColors: Record<string, string> = {
    connect: 'bg-blue-100 text-blue-700',
    visuals: 'bg-pink-100 text-pink-700',
    threads: 'bg-green-100 text-green-700',
    careernet: 'bg-purple-100 text-purple-700',
  };

  const modules = post.module.split(',').map((m) => m.trim());

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        {/* Post Header */}
        <div className="flex items-center mb-3">
          <Link href={`/${post.user.username}/profile`}>
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 flex-shrink-0">
              {post.user.profile?.avatar_url ? (
                <Image
                  src={post.user.profile.avatar_url}
                  alt={post.user.full_name}
                  width={40}
                  height={40}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  {post.user.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/${post.user.username}/profile`}>
              <p className="font-semibold text-gray-900 truncate">
                {post.user.full_name}
              </p>
            </Link>
            <p className="text-sm text-gray-500 truncate">@{post.user.username}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div className="flex gap-1">
              {modules.map((module) => (
                <span
                  key={module}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    moduleColors[module] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {module}
                </span>
              ))}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Repost indicator and reposter's comment */}
        {isRepost && post.parent && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">🔄</span>
              <Link href={`/${post.user.username}/profile`}>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {post.user.full_name}
                </span>
              </Link>
              <span className="text-sm text-gray-500 dark:text-gray-400">reposted</span>
            </div>
            {post.content && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                {post.content}
              </p>
            )}
          </div>
        )}

        {/* Original Post (for reposts) or Regular Post Content */}
        {isRepost && post.parent && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 bg-white dark:bg-gray-800">
            {/* Original Post Author */}
            <div className="flex items-center mb-2">
              <Link href={`/${post.parent.user.username}/profile`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden mr-2 flex-shrink-0">
                  {post.parent.user.profile?.avatar_url ? (
                    <Image
                      src={post.parent.user.profile.avatar_url}
                      alt={post.parent.user.full_name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                      {post.parent.user.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/${post.parent.user.username}/profile`}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {post.parent.user.full_name}
                  </p>
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  @{post.parent.user.username}
                </p>
              </div>
            </div>
            
            {/* Original Post Content */}
            <p className="text-gray-900 dark:text-gray-100 mb-3 whitespace-pre-wrap">{displayContent}</p>
          </div>
        )}

        {/* Regular Post Content (not a repost) */}
        {!isRepost && (
          <p className="text-gray-900 dark:text-gray-100 mb-3 whitespace-pre-wrap">{displayContent}</p>
        )}

        {/* Poll */}
        {displayPost.is_poll && <PollComponent postId={displayPost.id} />}

        {/* Post Media */}
        {mediaUrls.length > 0 && (
          <div className="mb-3">
            {mediaUrls.length === 1 ? (
              <div
                className="relative w-full aspect-video rounded-lg overflow-hidden cursor-pointer bg-gray-100"
                onClick={() => setSelectedImage(mediaUrls[0])}
              >
                {mediaUrls[0].match(/\.(mp4|webm|mov)$/i) ? (
                  <video
                    src={mediaUrls[0]}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Image
                    src={mediaUrls[0]}
                    alt="Post media"
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mediaUrls.slice(0, 4).map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-100"
                    onClick={() => setSelectedImage(url)}
                  >
                    {url.match(/\.(mp4|webm|mov)$/i) ? (
                      <video
                        src={url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={url}
                        alt={`Post media ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hashtags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag, idx) => (
              <Link
                key={idx}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Reactions - react to the original post if repost, otherwise react to current post */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <ReactionsBar 
            post={displayPost} 
            variant="default" 
            onRepost={onRepost && !isRepost ? () => onRepost(displayPost.id) : undefined}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              className="absolute top-4 right-4 text-white text-2xl z-10"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            {selectedImage.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                src={selectedImage}
                controls
                autoPlay
                className="max-w-full max-h-screen"
              />
            ) : (
              <Image
                src={selectedImage}
                alt="Full size"
                width={1200}
                height={800}
                className="max-w-full max-h-screen object-contain"
              />
            )}
          </div>
        </div>
      )}

      {isOwner && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete this post?"
          message="This action cannot be undone. The post and its comments will be removed."
          confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          confirmVariant="danger"
          onCancel={() => {
            if (!deleteMutation.isPending) {
              setShowDeleteConfirm(false);
            }
          }}
          onConfirm={() => {
            if (!deleteMutation.isPending) {
              deleteMutation.mutate();
            }
          }}
        />
      )}
    </>
  );
}
