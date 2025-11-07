import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import Logo from '../../components/Logo';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { getUser, clearAuth } from '../../lib/auth';
import { profileAPI, usersAPI } from '../../lib/api';

export default function AccountSettings() {
  const router = useRouter();
  const user = getUser();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user profile to get current avatar
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => profileAPI.getProfile(),
    enabled: !!user?.id,
  });

  const currentAvatarUrl = avatarPreview || profileData?.profile?.avatar_url;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Please select an image file', type: 'error', isVisible: true });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'File size must be less than 5MB', type: 'error', isVisible: true });
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setUploading(true);
    try {
      const response = await profileAPI.uploadAvatar(avatarFile);
      // Update profile with new avatar URL (partial update)
      await profileAPI.updateProfile({
        avatar_url: response.avatar_url,
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      refetchProfile();
      setToast({ message: 'Avatar updated successfully!', type: 'success', isVisible: true });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      setToast({ message: error.response?.data?.error || 'Failed to upload avatar', type: 'error', isVisible: true });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: () => usersAPI.deleteAccount(),
    onSuccess: () => {
      clearAuth();
      router.push('/');
    },
    onError: (error: any) => {
      setToast({ message: error.response?.data?.error || 'Failed to delete account', type: 'error', isVisible: true });
    },
  });

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = () => {
    deleteAccountMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  return (
    <Layout title="Account Settings - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <span className="text-xl">←</span>
              </button>
              <Logo size="sm" showText={false} onClick={() => {}} />
              <h1 className="text-2xl font-bold text-gray-900">Account</h1>
            </div>
            <p className="text-sm text-gray-500">
              Manage your account preferences and data
            </p>
          </div>

          <div className="px-4 py-6 space-y-6">
            {/* Profile Avatar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Profile Picture</h2>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {currentAvatarUrl ? (
                    <Image
                      src={currentAvatarUrl}
                      alt={user?.full_name || 'Profile'}
                      width={120}
                      height={120}
                      className="rounded-full object-cover border-4 border-gray-200"
                    />
                  ) : (
                    <div className="w-30 h-30 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                      <span className="text-4xl font-bold text-gray-400">
                        {user?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2"
                  >
                    {avatarFile ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  {avatarFile && (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleAvatarUpload}
                        loading={uploading}
                        disabled={uploading}
                        className="px-4 py-2"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelAvatar}
                        disabled={uploading}
                        className="px-4 py-2"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
                {avatarFile && (
                  <p className="text-xs text-gray-500 text-center">
                    Selected: {avatarFile.name} ({(avatarFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Account Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="text-base font-medium text-gray-900">{user?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Username</p>
                  <p className="text-base font-medium text-gray-900">@{user?.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-base font-medium text-gray-900">{user?.email}</p>
                </div>
                {user?.role && (
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="text-base font-medium text-gray-900 capitalize">{user.role}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={() => router.push('/analytics')}
                  className="w-full"
                >
                  View Analytics
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/bookmarks')}
                  className="w-full"
                >
                  View Bookmarks
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full"
                >
                  Logout
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDeleteAccount}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete Account
                </Button>
              </div>
            </div>

            {/* Data Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Data Management</h2>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setToast({ message: 'Data export feature coming soon', type: 'info', isVisible: true });
                  }}
                  className="w-full"
                >
                  Export My Data
                </Button>
              </div>
            </div>
          </div>
        </div>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Account"
          message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted."
          confirmText="Delete Account"
          cancelText="Cancel"
          confirmVariant="danger"
          onConfirm={confirmDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />

        <BottomNav />
      </Layout>
  );
}

