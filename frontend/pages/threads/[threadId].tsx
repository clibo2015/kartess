import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { threadsAPI } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import Link from 'next/link';
import Image from 'next/image';

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;
  const [replyText, setReplyText] = useState('');
  const [parentReplyId, setParentReplyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentUser = getUser();

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => threadsAPI.getThread(threadId as string),
    enabled: !!threadId,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      threadsAPI.createReply(threadId as string, {
        content,
        parent_id: parentReplyId || undefined,
      }),
    onSuccess: () => {
      setReplyText('');
      setParentReplyId(null);
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    },
  });

  useEffect(() => {
    if (!threadId) return;

    const socket = getSocket();
    socket.emit('join:thread', threadId);

    socket.on('thread.reply.new', () => {
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    });

    return () => {
      socket.emit('leave:thread', threadId);
      socket.off('thread.reply.new');
    };
  }, [threadId, queryClient]);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || thread?.locked) return;
    replyMutation.mutate(replyText.trim());
  };

  const renderReply = (reply: any, depth = 0) => {
    if (depth > 2) return null; // Max nesting

    return (
      <div key={reply.id} className={`${depth > 0 ? 'ml-6 mt-2 border-l-2 border-gray-200 pl-3' : 'mt-4'}`}>
        <div className="flex items-start gap-2">
          {reply.user.profile?.avatar_url ? (
            <Image
              src={reply.user.profile.avatar_url}
              alt={reply.user.full_name}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs">
              {reply.user.full_name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm">
                {reply.user.full_name}
              </p>
              <span className="text-xs text-gray-500">
                {new Date(reply.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
            {!thread?.locked && depth < 2 && (
              <button
                onClick={() => {
                  setParentReplyId(reply.id);
                  document.getElementById('reply-input')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs text-green-600 hover:text-green-700 mt-1"
              >
                Reply
              </button>
            )}
          </div>
        </div>

        {/* Nested replies */}
        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-2">
            {reply.replies.map((nestedReply: any) => renderReply(nestedReply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout title={thread?.title || 'Thread - Kartess'}>
        <div className="min-h-screen bg-gray-50 pb-20">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !thread ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Thread not found</p>
              <Button
                variant="secondary"
                onClick={() => router.push('/threads')}
                className="mt-4"
              >
                Back to Threads
              </Button>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-6">
                <Link
                  href="/threads"
                  className="text-green-600 hover:text-green-700 text-sm mb-4 inline-block"
                >
                  ← Back to Threads
                </Link>

                <div className="flex items-start gap-3 mb-4">
                  {thread.user.profile?.avatar_url ? (
                    <Image
                      src={thread.user.profile.avatar_url}
                      alt={thread.user.full_name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      {thread.user.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{thread.user.full_name}</p>
                    <p className="text-sm text-gray-500">@{thread.user.username}</p>
                  </div>
                  {thread.pinned && <span className="text-green-600">📌</span>}
                  {thread.locked && <span className="text-gray-500">🔒</span>}
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-3">{thread.title}</h1>
                {thread.topic && (
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm rounded mb-3">
                    {thread.topic}
                  </span>
                )}
                <p className="text-gray-700 whitespace-pre-wrap mb-4">{thread.content}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>👁️ {thread.views_count} views</span>
                  <span>💬 {thread.replies_count} replies</span>
                  <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Replies */}
              <div className="px-4 py-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Replies ({thread.replies_count})
                </h2>

                {thread.replies && thread.replies.length > 0 ? (
                  <div className="space-y-4">
                    {thread.replies
                      .filter((r: any) => !r.parent_id)
                      .map((reply: any) => renderReply(reply))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No replies yet</p>
                )}

                {/* Reply Form */}
                {!thread.locked && (
                  <div id="reply-input" className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    {parentReplyId && (
                      <div className="mb-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        Replying to a comment...
                        <button
                          onClick={() => setParentReplyId(null)}
                          className="text-green-600 hover:text-green-700 ml-2"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleReply} className="flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        rows={3}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={!replyText.trim() || replyMutation.isPending}
                        className="px-4 text-sm bg-green-600"
                      >
                        Reply
                      </Button>
                    </form>
                  </div>
                )}

                {thread.locked && (
                  <div className="text-center py-8 text-gray-500">
                    This thread is locked. No new replies can be posted.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <BottomNav />
      </Layout>
  );
}
