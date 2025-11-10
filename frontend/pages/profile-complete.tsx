import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import FormField from '../components/FormField';
import { profileAPI, authAPI } from '../lib/api';
import { getToken, setAuth } from '../lib/auth';

const profileSchema = z.object({
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  company: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  education: z.string().optional(),
});

type FormData = z.infer<typeof profileSchema> & {
  avatar?: File | null;
  avatar_url?: string;
};

export default function ProfileComplete() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    bio: '',
    company: '',
    position: '',
    phone: '',
    education: '',
    avatar: null,
    avatar_url: undefined,
  });

  // Check if profile already exists and user is authenticated
  useEffect(() => {
    const checkProfile = async () => {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await authAPI.verify();
        if (response.profileComplete) {
          // Profile already complete, redirect to home
          router.push('/home');
        } else if (response.profile) {
          // Load existing profile data
          setFormData({
            bio: response.profile.bio || '',
            company: response.profile.company || '',
            position: response.profile.position || '',
            phone: response.profile.phone || '',
            education: response.profile.education || '',
            avatar_url: response.profile.avatar_url,
          });
        }
        // If profile is not complete and no profile exists, user can proceed to fill the form
      } catch (error) {
        // If verification fails, don't immediately redirect to login
        // The user might have just registered and the token is valid but verify call failed
        // (e.g., due to network issues, etc.)
        // Allow user to stay on the page - they can still complete their profile
        // Only redirect if token is definitely invalid (which would be handled by the token check above)
        console.warn('Token verification failed, but allowing user to continue:', error);
        // Don't redirect - let the user complete their profile
      } finally {
        setChecking(false);
      }
    };

    checkProfile();
  }, [router]);

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
      setFormData((prev) => ({ ...prev, avatar_url: response.avatar_url }));
    } catch (error: any) {
      setErrors({ avatar: error.response?.data?.error || 'Failed to upload avatar' });
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

      // Validate form data
      const validatedData = profileSchema.parse({
        bio: formData.bio,
        company: formData.company,
        position: formData.position,
        phone: formData.phone,
        education: formData.education,
      });

      // Complete profile
      await profileAPI.complete({
        ...validatedData,
        avatar_url: avatarUrl,
      });

      // Update profile complete status
      const verifyResponse = await authAPI.verify();
      setAuth({
        token: getToken()!,
        user: verifyResponse.user,
        profileComplete: true,
      });

      // Redirect to home
      router.push('/home');
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const pathKey = issue.path[0];
          if (typeof pathKey === 'string') {
            fieldErrors[pathKey] = issue.message;
          }
        });
        setErrors(fieldErrors);
      } else if (isAxiosError(error) && error.response?.data) {
        const errorMessage = (error.response.data as { error?: string })?.error;
        setErrors({ general: errorMessage || 'Failed to complete profile' });
      } else {
        setErrors({ general: 'An error occurred. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Layout title="Profile - Kartess">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Complete Profile - Kartess">
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h1>
            <p className="text-gray-600">
              Tell us about yourself to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {errors.general}
              </div>
            )}

            <FormField label="Bio" error={errors.bio} required>
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
                Minimum 10 characters
              </p>
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <FormField label="Avatar" error={errors.avatar}>
              <div className="space-y-2">
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
                {formData.avatar_url && (
                  <div className="mt-2">
                    <img
                      src={formData.avatar_url}
                      alt="Avatar preview"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  </div>
                )}
              </div>
            </FormField>

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-6"
            >
              Complete Profile
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
