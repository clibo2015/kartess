import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import Input from '../../components/Input';
import FormField from '../../components/FormField';
import { liveAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';

const CATEGORIES = [
  'Gaming',
  'Music',
  'Art & Creative',
  'Technology',
  'Education',
  'Lifestyle',
  'Other',
];

export default function CreateLiveStream() {
  const router = useRouter();
  const currentUser = getUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
    }
  }, [currentUser, router]);

  const startCameraPreview = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrors({ camera: 'Camera access is not available in this browser.' });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraStarted(true);
        setErrors({});
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrors({ camera: 'Camera permission was denied. Please enable camera access in your browser settings.' });
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setErrors({ camera: 'No camera found. Please ensure a camera is connected.' });
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setErrors({ camera: 'Camera is already in use by another application.' });
      } else {
        setErrors({ camera: `Camera access error: ${error.message || 'Unknown error'}` });
      }
    }
  };

  const stopCameraPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStarted(false);
  };

  useEffect(() => {
    return () => {
      stopCameraPreview();
    };
  }, []);

  const createSessionMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; category?: string }) =>
      liveAPI.createSession({
        type: 'live',
        title: data.title,
        description: data.description,
        category: data.category,
      }),
    onSuccess: (data) => {
      stopCameraPreview();
      router.push(`/live/${data.session.id}`);
    },
    onError: (error: any) => {
      setErrors({ general: error?.response?.data?.error || 'Failed to create live stream' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!title.trim()) {
      setErrors({ title: 'Stream title is required' });
      return;
    }

    if (!category) {
      setErrors({ category: 'Please select a category' });
      return;
    }

    createSessionMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
    });
  };

  const handleCancel = () => {
    stopCameraPreview();
    router.back();
  };

  return (
    <Layout title="Start Live Stream - Kartess">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              📹 Start Live Stream
            </h1>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {/* Camera Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Camera Preview
            </label>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              {cameraStarted && videoRef.current ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <button
                    type="button"
                    onClick={startCameraPreview}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <span>📹</span>
                    <span>Start Camera Preview</span>
                  </button>
                </div>
              )}
            </div>
            {errors.camera && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.camera}</p>
            )}
            {cameraStarted && (
              <button
                type="button"
                onClick={stopCameraPreview}
                className="mt-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Stop Camera Preview
              </button>
            )}
          </div>

          {/* Stream Title */}
          <FormField label="Stream Title" error={errors.title}>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your stream about?"
              className="w-full"
              required
            />
          </FormField>

          {/* Description */}
          <FormField label="Description" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what to expect..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </FormField>

          {/* Category */}
          <FormField label="Category" error={errors.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </FormField>

          {/* General Error */}
          {errors.general && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              className="flex-1"
              disabled={createSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={createSessionMutation.isPending || !title.trim() || !category}
            >
              {createSessionMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                '🔴 Go Live'
              )}
            </Button>
          </div>
        </form>
      </div>

      <BottomNav />
    </Layout>
  );
}

