import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { chatsAPI, contactsAPI } from '../lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { decryptMessage } from '../lib/encryption';

export default function Chats() {
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chatThreads'],
    queryFn: () => chatsAPI.getThreads(),
  });

  const threads = data?.threads || [];

  return (
    <Layout title="Messages - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <Button
                variant="primary"
                onClick={() => router.push('/chats/new')}
                className="text-sm"
              >
                + New
              </Button>
            </div>
          </div>

          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No messages yet</p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/chats/new')}
                >
                  Start a Conversation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((thread: any) => {
                  const otherParticipant = thread.participants?.[0];
                  const displayName =
                    thread.type === 'group'
                      ? thread.name
                      : otherParticipant?.full_name || 'Unknown';
                  const displayAvatar = otherParticipant?.profile?.avatar_url;

                  return (
                    <Link
                      key={thread.id}
                      href={`/chats/${thread.id}`}
                      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {displayAvatar ? (
                            <Image
                              src={displayAvatar}
                              alt={displayName}
                              width={48}
                              height={48}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {displayName}
                            </p>
                            {thread.latestMessage && (
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(thread.latestMessage.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          {thread.latestMessage ? (
                            <p className="text-sm text-gray-600 truncate">
                              {thread.latestMessage.encrypted
                                ? decryptMessage(thread.latestMessage.content)
                                : thread.latestMessage.content}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">No messages yet</p>
                          )}
                        </div>
                        {thread.unreadCount > 0 && (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
