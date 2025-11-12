import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';
import { chatsAPI, messagesAPI } from '../../lib/api';
import { decryptMessage, encryptMessage } from '../../lib/encryption';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';

export default function ChatView() {
  const router = useRouter();
  const { threadId } = router.query;
  const activeThreadId =
    typeof threadId === 'string'
      ? threadId
      : Array.isArray(threadId)
      ? threadId[0]
      : undefined;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socket = useRef<any>(null);
  const currentUser = getUser();

  // Get thread details
  const {
    data: threadsData,
    isLoading: threadsLoading,
  } = useQuery({
    queryKey: ['chatThreads'],
    queryFn: () => chatsAPI.getThreads(),
  });

  const thread = threadsData?.threads?.find((t: any) => t.id === activeThreadId);

  // Get messages
  const {
    data: messagesData,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['messages', activeThreadId],
    queryFn: () => chatsAPI.getMessages(activeThreadId as string, { limit: 50 }),
    enabled: !!activeThreadId,
    refetchInterval: false, // Disable automatic refetch - rely on Socket.io for real-time updates
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const messages = messagesData?.messages || [];

  // Set up Socket.io
  useEffect(() => {
    if (!activeThreadId || typeof window === 'undefined') return;

    const socketInstance = getSocket();
    socket.current = socketInstance;

    // Join thread
    socketInstance.emit('join:thread', activeThreadId);

    // Listen for new messages - update cache immediately for real-time updates
    const handleNewMessage = (newMessage: any) => {
      // Only update if message is for current thread
      if (newMessage.thread_id === activeThreadId) {
        queryClient.setQueryData(['messages', activeThreadId], (old: any) => {
          if (!old) return { messages: [newMessage], nextCursor: null };
          // Check if message already exists to avoid duplicates
          const messageExists = old.messages.some((msg: any) => msg.id === newMessage.id);
          if (messageExists) return old;
          return {
            ...old,
            messages: [...old.messages, newMessage],
          };
        });
        scrollToBottom();
      }
    };

    socketInstance.on('message.new', handleNewMessage);

    // Listen for typing indicators
    socketInstance.on('thread:typing', (data: { user_id: string; typing: boolean }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.typing) {
          newSet.add(data.user_id);
        } else {
          newSet.delete(data.user_id);
        }
        return newSet;
      });
    });

    // Listen for read receipts
    socketInstance.on('message.read', (data: { message_id: string; user_id: string }) => {
      // Update message read status if needed
      queryClient.invalidateQueries({ queryKey: ['messages', activeThreadId] });
    });

    // Listen for message deleted
    socketInstance.on('message.deleted', (data: { message_id: string; thread_id: string }) => {
      if (data.thread_id === activeThreadId) {
        queryClient.setQueryData(['messages', activeThreadId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.filter((msg: any) => msg.id !== data.message_id),
          };
        });
      }
    });

    // Listen for thread deleted
    socketInstance.on('thread.deleted', (data: { thread_id: string }) => {
      if (data.thread_id === activeThreadId) {
        router.push('/chats');
      }
    });

    return () => {
      socketInstance.emit('leave:thread', activeThreadId);
      socketInstance.off('message.new');
      socketInstance.off('thread:typing');
      socketInstance.off('message.read');
      socketInstance.off('message.deleted');
      socketInstance.off('thread.deleted');
    };
  }, [activeThreadId, queryClient, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB
      const isValidType =
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/');
      return isValidSize && isValidType;
    });

    if (validFiles.length !== files.length) {
        alert('Some files were invalid. Only images, videos, and audio files under 50MB are allowed.');
    }

    setMediaFiles((prev) => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMutation = useMutation({
    mutationFn: (data: { content: string; encrypted: boolean; media?: File[] }) =>
      messagesAPI.send({
        thread_id: activeThreadId as string,
        ...data,
      }),
    onSuccess: () => {
      setMediaFiles([]);
      setMediaPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setMessage('');
      refetchMessages();
      scrollToBottom();
    },
  });

  const handleTyping = (value: string) => {
    setMessage(value);

    // Send typing indicator
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      if (socket.current && activeThreadId) {
        socket.current.emit('thread:typing', {
          thread_id: activeThreadId,
          typing: true,
        });
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket.current && activeThreadId) {
        socket.current.emit('thread:typing', {
          thread_id: activeThreadId,
          typing: false,
        });
      }
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && mediaFiles.length === 0) || sendMutation.isPending) return;

    const contentToSend = message.trim() || (mediaFiles.length > 0 ? '📎' : '');
    const encryptedContent = encryptMessage(contentToSend);
    sendMutation.mutate({
      content: encryptedContent,
      encrypted: true,
      media: mediaFiles.length > 0 ? mediaFiles : undefined,
    });

    // Stop typing indicator
    setIsTyping(false);
    if (socket.current && activeThreadId) {
      socket.current.emit('thread:typing', {
        thread_id: activeThreadId,
        typing: false,
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => messagesAPI.delete(messageId),
    onSuccess: () => {
      setShowDeleteMessageConfirm(false);
      setSelectedMessage(null);
      refetchMessages();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || 'Failed to delete message');
    },
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: () => chatsAPI.deleteThread(activeThreadId as string),
    onSuccess: () => {
      setShowDeleteChatConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      router.push('/chats');
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || 'Failed to delete chat');
    },
  });

  const handleDeleteMessage = (messageId: string) => {
    setSelectedMessage(messageId);
    setShowDeleteMessageConfirm(true);
  };

  const handleDeleteChat = () => {
    setShowDeleteChatConfirm(true);
  };

  if (!router.isReady || threadsLoading) {
    return (
      <Layout title="Chat - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  if (!thread) {
    return (
      <Layout title="Chat - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-gray-500">Conversation not found.</p>
            <Button variant="primary" onClick={() => router.push('/chats')}>
              Back to Messages
            </Button>
          </div>
        </div>
        <BottomNav />
      </Layout>
    );
  }

  const otherParticipant = thread.participants?.[0];
  const displayName =
    thread.type === 'group' ? thread.name : otherParticipant?.full_name || 'Unknown';

  return (
    <Layout title={displayName}>
        <div className="flex flex-col h-screen pb-20 bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 min-w-0">
            <button onClick={() => router.back()} className="text-gray-600 flex-shrink-0">
              ← Back
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {otherParticipant?.profile?.avatar_url ? (
                <Image
                  src={otherParticipant.profile.avatar_url}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                {typingUsers.size > 0 && (
                  <p className="text-xs text-gray-500">typing...</p>
                )}
              </div>
            </div>
            {/* Call Buttons and Delete Chat */}
            <div className="flex gap-2 flex-shrink-0">
              {thread.type === '1:1' && (
                <>
                  <button
                    onClick={() => router.push(`/chats/${activeThreadId}/call?type=voice`)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    title="Voice Call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => router.push(`/chats/${activeThreadId}/call?type=video`)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Video Call"
                  >
                    📹
                  </button>
                </>
              )}
              <button
                onClick={handleDeleteChat}
                className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Delete Chat"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg: any) => {
              const isOwn = msg.user_id === currentUser?.id;
              const decryptedContent = msg.encrypted
                ? decryptMessage(msg.content)
                : msg.content;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className="relative">
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      {msg.user_id !== currentUser?.id && (
                        <p className="text-xs font-medium mb-1 opacity-75">
                          {msg.user.full_name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{decryptedContent}</p>
                      {msg.media_urls && Array.isArray(msg.media_urls) && (
                        <div className="mt-2 space-y-2">
                          {(msg.media_urls as string[]).map((url, idx) => (
                            <div key={idx} className="rounded-lg overflow-hidden">
                              {url.match(/\.(mp4|webm|mov)$/i) ? (
                                <video src={url} controls className="max-w-full" />
                              ) : (
                                <Image
                                  src={url}
                                  alt={`Media ${idx + 1}`}
                                  width={300}
                                  height={200}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-75">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {isOwn && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="ml-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                            title="Delete message"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Media Previews */}
          {mediaPreviews.length > 0 && (
            <div className="bg-white border-t border-gray-200 px-4 py-3">
              <div 
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {mediaPreviews.map((preview, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                      {mediaFiles[idx]?.type.startsWith('video/') ? (
                        <video
                          src={preview}
                          className="w-full h-full object-cover"
                        />
                      ) : mediaFiles[idx]?.type.startsWith('audio/') ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <span className="text-2xl">🎵</span>
                        </div>
                      ) : (
                        <Image
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-3 pb-safe">
            <div className="flex gap-1.5 sm:gap-2 mb-2 min-w-0 overflow-x-auto scrollbar-hide">
              <Link href={`/chats/${activeThreadId}/call?type=voice`} className="flex-shrink-0">
                <Button variant="secondary" className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                  📞 Voice
                </Button>
              </Link>
              <Link href={`/chats/${activeThreadId}/call?type=video`} className="flex-shrink-0">
                <Button variant="secondary" className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                  📹 Video
                </Button>
              </Link>
            </div>
            <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm sm:text-base"
                title="Attach media"
              >
                📎
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 min-h-[36px] sm:min-h-[44px] px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={(!message.trim() && mediaFiles.length === 0) || sendMutation.isPending}
                className="flex-shrink-0 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap"
              >
                Send
              </Button>
            </form>
          </div>
        </div>

        <BottomNav />

        {/* Delete Message Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteMessageConfirm}
          title="Delete Message?"
          message="This message will be deleted for everyone in this chat. This action cannot be undone."
          confirmText={deleteMessageMutation.isPending ? 'Deleting...' : 'Delete'}
          confirmVariant="danger"
          onCancel={() => {
            if (!deleteMessageMutation.isPending) {
              setShowDeleteMessageConfirm(false);
              setSelectedMessage(null);
            }
          }}
          onConfirm={() => {
            if (!deleteMessageMutation.isPending && selectedMessage) {
              deleteMessageMutation.mutate(selectedMessage);
            }
          }}
        />

        {/* Delete Chat Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteChatConfirm}
          title="Delete Chat?"
          message="This will delete the entire chat and all messages for all participants. This action cannot be undone."
          confirmText={deleteChatMutation.isPending ? 'Deleting...' : 'Delete Chat'}
          confirmVariant="danger"
          onCancel={() => {
            if (!deleteChatMutation.isPending) {
              setShowDeleteChatConfirm(false);
            }
          }}
          onConfirm={() => {
            if (!deleteChatMutation.isPending) {
              deleteChatMutation.mutate();
            }
          }}
        />
      </Layout>
  );
}
