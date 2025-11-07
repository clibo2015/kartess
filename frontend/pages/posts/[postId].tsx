import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import PostCard from '../../components/PostCard';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Image from 'next/image';
import Link from 'next/link';
import { postsAPI, commentsAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function PostDetailPage() {
  const router = useRouter();
  const { postId, commentId } = router.query;
  const activePostId =
    typeof postId === 'string'
      ? postId
      : Array.isArray(postId)
      ? postId[0]
      : undefined;

  const highlightCommentId =
    typeof commentId === 'string'
      ? commentId
      : Array.isArray(commentId)
      ? commentId[0]
      : undefined;

  const queryClient = useQueryClient();
  const currentUser = getUser();
  const [commentText, setCommentText] = useState('');
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    data: postData,
    isLoading: postLoading,
    isError: postError,
  } = useQuery({
    queryKey: ['post', activePostId],
    queryFn: () => postsAPI.getPost(activePostId as string),
    enabled: !!activePostId,
  });

  const {
    data: commentsData,
    isLoading: commentsLoading,
  } = useQuery({
    queryKey: ['comments', activePostId],
    queryFn: () => commentsAPI.getPostComments(activePostId as string),
    enabled: !!activePostId,
  });

  const comments = useMemo(
    () => commentsData?.comments || [],
    [commentsData?.comments]
  );

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      commentsAPI.create({
        post_id: activePostId as string,
        content,
      }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', activePostId] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  useEffect(() => {
    if (!highlightCommentId || comments.length === 0) return;

    const handle = setTimeout(() => {
      const element = commentRefs.current[highlightCommentId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500');
        }, 2000);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [highlightCommentId, comments]);

  if (!router.isReady || postLoading || !activePostId) {
    return (
      <Layout title="Post - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  if (postError || !postData) {
    return (
      <Layout title="Post - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-gray-500">
              {postError ? 'Unable to load post.' : 'Post not found.'}
            </p>
            <Button variant="primary" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
        <BottomNav />
      </Layout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || commentMutation.isPending) return;
    commentMutation.mutate(commentText.trim());
  };

  return (
    <Layout title="Post - Kartess">
        <div className="min-h-screen bg-gray-50 pb-28">
          <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => router.back()} className="px-3 py-2 text-sm">
              ← Back
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Post</h1>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <PostCard post={postData} />

            <section className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
                <span className="text-sm text-gray-500">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto px-4 py-4 space-y-4">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No comments yet.</p>
                ) : (
                  comments.map((comment: any) => (
                    <div
                      key={comment.id}
                      ref={(el) => {
                        commentRefs.current[comment.id] = el;
                      }}
                      className="flex gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3"
                    >
                      <Link href={`/${comment.user.username}/profile`}>
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {comment.user.profile?.avatar_url ? (
                            <Image
                              src={comment.user.profile.avatar_url}
                              alt={comment.user.full_name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              {comment.user.full_name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Link href={`/${comment.user.username}/profile`}>
                            <p className="font-semibold text-sm text-gray-900">
                              {comment.user.full_name}
                            </p>
                          </Link>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {currentUser ? (
                <div className="border-t border-gray-200 px-4 py-3">
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
                    >
                      Post
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                    Log in
                  </Link>{' '}
                  to join the conversation.
                </div>
              )}
            </section>
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}

