import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { isAxiosError } from 'axios';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import Input from '../../components/Input';
import FormField from '../../components/FormField';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import { profileAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';

type FormData = {
  bio?: string;
  company?: string;
  position?: string;
  phone?: string;
  education?: string;
  avatar?: File | null;
  avatar_url?: string;
};

export default function ProfileEdit() {
  const router = useRouter();
  const currentUser = getUser();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });
  const [formData, setFormData] = useState<FormData>({
    bio: '',
    company: '',
    position: '',
    phone: '',
    education: '',
    avatar: null,
    avatar_url: undefined,
  });

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      try {
        setFetching(true);
        const response = await profileAPI.getProfile();
        if (response.profile) {
          setFormData({
            bio: response.profile.bio || '',
            company: response.profile.company || '',
            position: response.profile.position || '',
            phone: response.profile.phone || '',
            education: response.profile.education || '',
            avatar_url: response.profile.avatar_url,
          });
        }
      } catch (error: any) {
        console.error('Failed to load profile:', error);
        setToast({
          message: 'Failed to load profile. Please try again.',
          type: 'error',
          isVisible: true,
        });
      } finally {
        setFetching(false);
      }
    };

    loadProfile();
  }, [currentUser, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors({ avatar: 'Please select an image file' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrors({ avatar: 'File size must be less than 10MB' });
        return;
      }
      setFormData((prev) => ({ ...prev, avatar: file }));
      setErrors((prev) => ({ ...prev, avatar: '' }));
    }
  };

  const handleAvatarUpload = async () => {
    if (!formData.avatar) return;

    setUploading(true);
    try {
      const response = await profileAPI.uploadAvatar(formData.avatar);
      setFormData((prev) => ({ ...prev, avatar_url: response.avatar_url, avatar: null }));
      setToast({
        message: 'Avatar uploaded successfully!',
        type: 'success',
        isVisible: true,
      });
    } catch (error: any) {
      setErrors({ avatar: error.response?.data?.error || 'Failed to upload avatar' });
      setToast({
        message: error.response?.data?.error || 'Failed to upload avatar',
        type: 'error',
        isVisible: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Upload avatar if selected and not already uploaded
      let avatarUrl = formData.avatar_url;
      if (formData.avatar && !avatarUrl) {
        const uploadResponse = await profileAPI.uploadAvatar(formData.avatar);
        avatarUrl = uploadResponse.avatar_url;
      }

      // Validate bio if provided (must be at least 10 characters if not empty)
      if (formData.bio && formData.bio.length > 0 && formData.bio.length < 10) {
        setErrors({ bio: 'Bio must be at least 10 characters if provided' });
        setLoading(false);
        return;
      }

      // Update profile (allows partial updates)
      await profileAPI.updateProfile({
        bio: formData.bio || undefined,
        company: formData.company || undefined,
        position: formData.position || undefined,
        phone: formData.phone || undefined,
        education: formData.education || undefined,
        avatar_url: avatarUrl,
      });

      setToast({
        message: 'Profile updated successfully!',
        type: 'success',
        isVisible: true,
      });

      // Redirect back to settings after a short delay
      setTimeout(() => {
        router.push('/settings');
      }, 1500);
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.data) {
        const errorMessage = (error.response.data as { error?: string })?.error;
        setErrors({ general: errorMessage || 'Failed to update profile' });
        setToast({
          message: errorMessage || 'Failed to update profile',
          type: 'error',
          isVisible: true,
        });
      } else {
        setErrors({ general: 'An error occurred. Please try again.' });
        setToast({
          message: 'An error occurred. Please try again.',
          type: 'error',
          isVisible: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Layout title="Edit Profile - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout title="Edit Profile - Kartess">
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <span className="text-gray-600 text-xl">←</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">
            Update your profile information
          </p>
        </div>

        {/* Form */}
        <div className="px-4 py-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {errors.general}
              </div>
            )}

            <FormField label="Bio" error={errors.bio}>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className={`w-full min-h-[44px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.bio ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Tell us about yourself..."
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.bio?.length || 0} characters {formData.bio && formData.bio.length > 0 && formData.bio.length < 10 && '(minimum 10 characters)'}
              </p>
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField label="Company" error={errors.company}>
                <Input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Company name"
                />
              </FormField>

              <FormField label="Position" error={errors.position}>
                <Input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="Job title"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField label="Phone" error={errors.phone}>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                />
              </FormField>

              <FormField label="Education" error={errors.education}>
                <Input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  placeholder="University, Degree"
                />
              </FormField>
            </div>

            <FormField label="Avatar" error={errors.avatar} className="mt-4">
              <div className="space-y-2">
                {formData.avatar_url && (
                  <div className="mb-2">
                    <img
                      src={formData.avatar_url}
                      alt="Avatar preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {formData.avatar && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAvatarUpload}
                      loading={uploading}
                      className="text-sm"
                    >
                      Upload Avatar
                    </Button>
                    <span className="text-sm text-gray-600">
                      {formData.avatar.name}
                    </span>
                  </div>
                )}
              </div>
            </FormField>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="flex-1"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>

      <BottomNav />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </Layout>
  );
}

