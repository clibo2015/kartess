import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pollsAPI, postsAPI } from '../lib/api';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  module?: string;
}

export default function CreatePollModal({
  isOpen,
  onClose,
  onSuccess,
  module = 'threads',
}: CreatePollModalProps) {
  const [content, setContent] = useState('');
  const [options, setOptions] = useState(['', '']);

  const createPostMutation = useMutation({
    mutationFn: (data: any) => postsAPI.createPost(data),
    onSuccess: async (post) => {
      // Create poll after post is created
      await pollsAPI.create(
        post.id,
        options.filter((opt) => opt.trim())
      );
      onSuccess();
      onClose();
      setContent('');
      setOptions(['', '']);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || options.filter((opt) => opt.trim()).length < 2) return;

    createPostMutation.mutate({
      content: content.trim(),
      module,
      is_poll: true,
    });
  };

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-top safe-area-bottom">
      <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create Poll</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Ask your question..."
              required
              maxLength={280}
            />
            <p className="text-xs text-gray-500 mt-1">{content.length}/280</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options (2-4 required) *
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Option ${index + 1}`}
                  required={index < 2}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <button
                type="button"
                onClick={addOption}
                className="text-sm text-blue-600 hover:text-blue-700 mt-2"
              >
                + Add Option
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                !content.trim() ||
                options.filter((opt) => opt.trim()).length < 2 ||
                createPostMutation.isPending
              }
              className="flex-1"
            >
              {createPostMutation.isPending ? <LoadingSpinner size="sm" /> : 'Create Poll'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
