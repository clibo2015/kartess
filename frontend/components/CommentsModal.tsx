import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsAPI } from '../lib/api';
import { getUser } from '../lib/auth';
import Button from './Button';
import Input from './Input';
import Image from 'next/image';
import Link from 'next/link';

interface CommentsModalProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentsModal({ postId, isOpen, onClose }: CommentsModalProps) {
  const [commentText, setCommentText] = useState('');
  const queryClient = useQueryClient();
  const currentUser = getUser();

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => commentsAPI.getPostComments(postId),
    enabled: isOpen,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      commentsAPI.create({
        post_id: postId,
        content,
      }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  };

  const comments = commentsData?.comments || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Comments</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No comments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <Link href={`/${comment.user.username}/profile`}>
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                      {comment.user.profile?.avatar_url ? (
                        <Image
                          src={comment.user.profile.avatar_url}
                          alt={comment.user.full_name}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                          {comment.user.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                      <Link href={`/${comment.user.username}/profile`}>
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {comment.user.full_name}
                        </p>
                      </Link>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {comment.content}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Form */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              loading={commentMutation.isPending}
              disabled={!commentText.trim()}
              className="px-4"
            >
              Post
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

