import { useState, useRef, useEffect } from 'react';
import Button from './Button';
import { postsAPI, pollsAPI } from '../lib/api';
import { getSocket } from '../lib/socket';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const modules = [
  { id: 'connect', name: 'Connect', icon: '🔗' },
  { id: 'visuals', name: 'Visuals', icon: '📸' },
  { id: 'threads', name: 'Threads', icon: '💬' },
  { id: 'careernet', name: 'CareerNet', icon: '💼' },
];

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultModule?: string;
  defaultIsReel?: boolean;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  onSuccess,
  defaultModule,
  defaultIsReel = false,
}: CreatePostModalProps) {
  const [showPollOptions, setShowPollOptions] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [content, setContent] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(
    defaultModule ? [defaultModule] : []
  );
  const [networkType, setNetworkType] = useState<'personal' | 'professional' | 'both'>('both');
  const [isReel, setIsReel] = useState(defaultIsReel);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isReelMode = Boolean(defaultIsReel);
  const moduleOptions = isReelMode ? modules.filter((m) => m.id === 'visuals') : modules;

  // Initialize form when modal opens with defaults
  useEffect(() => {
    if (isOpen) {
      if (defaultModule) {
        setSelectedModules([defaultModule]);
      } else if (isReelMode) {
        setSelectedModules(['visuals']);
      }
      setIsReel(Boolean(defaultIsReel));
    }
  }, [isOpen, defaultModule, defaultIsReel, isReelMode]);

  if (!isOpen) return null;

  const handleModuleToggle = (moduleId: string) => {
    if (isReelMode) {
      return;
    }

    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      const isValidType =
        file.type.startsWith('image/') || file.type.startsWith('video/');
      return isValidSize && isValidType;
    });

    setMediaFiles((prev) => [...prev, ...validFiles]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const extractTags = (text: string): string[] => {
    const tagRegex = /#(\w+)/g;
    const matches = text.match(tagRegex);
    return matches ? matches.map((tag) => tag.substring(1)) : [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert('Please enter some content');
      return;
    }

    const finalModules = isReelMode ? ['visuals'] : selectedModules;

    if (finalModules.length === 0) {
      alert('Please select at least one module');
      return;
    }

    // Validate poll if creating poll
    if (showPollOptions) {
      const validOptions = pollOptions.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        alert('Poll must have at least 2 options');
        return;
      }
    }

    // Enforce 280 char limit for threads
    if (selectedModules.includes('threads') && content.length > 280) {
      alert('Thread posts must be 280 characters or less');
      return;
    }

    setLoading(true);

    try {
      const extractedTags = extractTags(content);
      const allTags = [...new Set([...tags, ...extractedTags])];

      // Auto-detect reel if video is uploaded to visuals module
      const hasVideo = mediaFiles.some(file => file.type.startsWith('video/'));
      const shouldMarkAsReel =
        hasVideo && finalModules.includes('visuals') && (isReelMode || isReel);

      if (isReelMode && !shouldMarkAsReel) {
        alert('Reels require at least one video clip.');
        setLoading(false);
        return;
      }

      const post = await postsAPI.create({
        content,
        module: finalModules.join(','),
        visibility: 'public',
        network_type: networkType,
        tags: allTags,
        media: mediaFiles.length > 0 ? mediaFiles : undefined,
        is_poll: showPollOptions,
        is_reel: shouldMarkAsReel,
      });

      // Create poll if needed
      if (showPollOptions && post?.id) {
        const validOptions = pollOptions.filter((opt) => opt.trim());
        await pollsAPI.create(post.id, validOptions);
      }

      // Subscribe to posts channel and emit new post
      const socket = getSocket();
      socket.emit('subscribe:posts');

      // Reset form
      setContent('');
      setSelectedModules(isReelMode ? ['visuals'] : []);
      setNetworkType('both');
      setIsReel(isReelMode);
      setMediaFiles([]);
      setTags([]);
      setShowPollOptions(false);
      setPollOptions(['', '']);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Post creation error:', error);
      alert(error.response?.data?.error || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-top safe-area-bottom">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Post</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Module Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Module(s) *
            </label>
            <div className="flex flex-wrap gap-2">
              {moduleOptions.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => handleModuleToggle(module.id)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedModules.includes(module.id)
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                  } ${isReelMode ? 'cursor-not-allowed opacity-70' : ''}`}
                  disabled={isReelMode}
                >
                  <span className="mr-2">{module.icon}</span>
                  {module.name}
                </button>
              ))}
            </div>
          </div>

          {/* Network Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Who can see this post?
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <input
                  type="radio"
                  name="network_type"
                  value="both"
                  checked={networkType === 'both'}
                  onChange={(e) => setNetworkType(e.target.value as 'both')}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Public (Both Networks)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Both personal and professional contacts/followers can see this post
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <input
                  type="radio"
                  name="network_type"
                  value="personal"
                  checked={networkType === 'personal'}
                  onChange={(e) => setNetworkType(e.target.value as 'personal')}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Personal Network Only</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only your personal contacts/followers can see this post
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <input
                  type="radio"
                  name="network_type"
                  value="professional"
                  checked={networkType === 'professional'}
                  onChange={(e) => setNetworkType(e.target.value as 'professional')}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Professional Network Only</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only your professional contacts/followers can see this post
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content *
            </label>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setTags(extractTags(e.target.value));
              }}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What's on your mind? Use #hashtags for tagging..."
            />
          </div>

          {/* Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Media ({mediaFiles.length} file{mediaFiles.length > 1 ? 's' : ''})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.map((file, idx) => (
                  <div key={idx} className="relative">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={URL.createObjectURL(file)}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              📎 Add Media (max 10MB each)
            </button>
          </div>

          {/* Reel Option - only show if visuals module selected and video uploaded */}
          {!isReelMode &&
            selectedModules.includes('visuals') &&
            mediaFiles.some((file) => file.type.startsWith('video/')) && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReel}
                  onChange={(e) => setIsReel(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900">Create as Reel</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Reels appear in the Reels feed and not in the unified timeline
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Tags Preview */}
          {tags.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Poll Options */}
          <div className="mb-4">
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={showPollOptions}
                onChange={(e) => setShowPollOptions(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Create Poll</span>
            </label>

            {showPollOptions && (
              <div className="mt-2 space-y-2 pl-6">
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updatePollOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required={idx < 2}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePollOption(idx)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Character Counter for Threads */}
          {selectedModules.includes('threads') && (
            <div className="mb-4">
              <p className="text-xs text-gray-500">
                {content.length}/280 characters
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              Post
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
