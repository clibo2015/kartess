import { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { threadsAPI } from '../../lib/api';

export default function NewThread() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; topic?: string }) =>
      threadsAPI.createThread(data),
    onSuccess: (thread) => {
      router.push(`/threads/${thread.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    createMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      topic: topic.trim() || undefined,
    });
  };

  return (
    <Layout title="New Thread - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Create New Thread</h1>
          </div>

          <div className="px-4 py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter thread title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Technology, Design, Career"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content * (280 characters max)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    if (e.target.value.length <= 280) {
                      setContent(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={10}
                  placeholder="Write your thread content..."
                  required
                  maxLength={280}
                />
                <p className="text-xs text-gray-500 mt-1">{content.length}/280</p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!title.trim() || !content.trim() || createMutation.isPending}
                  className="flex-1 bg-green-600"
                >
                  {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Create Thread'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
