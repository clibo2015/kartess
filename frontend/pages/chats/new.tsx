import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { chatsAPI, contactsAPI } from '../../lib/api';

export default function NewChat() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsAPI.getContacts(),
  });

  const createThreadMutation = useMutation({
    mutationFn: (participantIds: string[]) =>
      chatsAPI.createThread({
        type: '1:1',
        participant_ids: participantIds,
      }),
    onSuccess: (data) => {
      router.push(`/chats/${data.thread.id}`);
    },
  });

  const contacts = contactsData?.contacts || [];
  const filteredContacts = contacts.filter((contact: any) => {
    const name = contact.user.full_name.toLowerCase();
    const username = contact.user.username.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || username.includes(query);
  });

  const handleStartChat = (userId: string) => {
    createThreadMutation.mutate([userId]);
  };

  return (
    <Layout title="New Chat - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => router.back()} className="text-gray-600">
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">New Chat</h1>
            </div>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
            />
          </div>

          <div className="px-4 py-4">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? 'No contacts found' : 'No contacts yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact: any) => (
                  <button
                    key={contact.id}
                    onClick={() => handleStartChat(contact.user.id)}
                    className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 flex items-center gap-3"
                    disabled={createThreadMutation.isPending}
                  >
                    {contact.user.profile?.avatar_url ? (
                      <Image
                        src={contact.user.profile.avatar_url}
                        alt={contact.user.full_name}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        {contact.user.full_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">
                        {contact.user.full_name}
                      </p>
                      <p className="text-sm text-gray-500">@{contact.user.username}</p>
                    </div>
                    {createThreadMutation.isPending && <LoadingSpinner size="sm" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
