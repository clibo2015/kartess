import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import QRGenerator from '../../components/QRGenerator';
import QRScanner from '../../components/QRScanner';
import PresetSelectionModal from '../../components/PresetSelectionModal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import Logo from '../../components/Logo';
import NotificationsBell from '../../components/NotificationsBell';
import NotificationsPanel from '../../components/NotificationsPanel';
import { contactsAPI } from '../../lib/api';
import { getUser, clearAuth } from '../../lib/auth';
import { disconnectSocket } from '../../lib/socket';

export default function UserProfile() {
  const router = useRouter();
  const { username } = router.query;
  const [isFollowing, setIsFollowing] = useState(false);
  const [isQRGeneratorOpen, setIsQRGeneratorOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });
  const currentUser = getUser();
  const queryClient = useQueryClient();

  // Get user by username (includes follower/following counts)
  const { data: userData, isLoading } = useQuery({
    queryKey: ['userByUsername', username],
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/${username}`)
        .then((res) => {
          if (!res.ok) throw new Error('User not found');
          return res.json();
        });
    },
    enabled: !!username,
  });

  const user = userData?.user;

  // Check follow status
  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsAPI.getContacts(),
    enabled: !!currentUser && !!user,
  });

  // Check if already following
  const checkFollowing = () => {
    if (!contactsData?.contacts || !user) return false;
    return contactsData.contacts.some((c: any) => c.user.id === user.id);
  };

  // Update isFollowing state when contacts data changes
  useEffect(() => {
    if (contactsData && user) {
      setIsFollowing(checkFollowing());
    }
  }, [contactsData, user]);

  const handleFollow = async (presetName: 'personal' | 'professional' | 'custom') => {
    if (!user) return;

    try {
      await contactsAPI.follow(user.id, presetName);
      setIsFollowing(true);
      // Refetch contacts to update UI
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['userByUsername', username] });
      setToast({ message: 'Follow request sent successfully!', type: 'success', isVisible: true });
    } catch (error: any) {
      console.error('Follow error:', error);
      setToast({ message: error.response?.data?.error || 'Failed to send follow request', type: 'error', isVisible: true });
    }
  };

  const handleUnfollow = () => {
    if (!user) return;
    setShowUnfollowConfirm(true);
  };

  const confirmUnfollow = async () => {
    if (!user) return;
    setShowUnfollowConfirm(false);
    setIsUnfollowing(true);
    try {
      await contactsAPI.unfollow(undefined, user.id);
      setIsFollowing(false);
      // Refetch contacts to update UI
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['userByUsername', username] });
      setToast({ message: 'Unfollowed successfully', type: 'success', isVisible: true });
    } catch (error: any) {
      console.error('Unfollow error:', error);
      setToast({ message: error.response?.data?.error || 'Failed to unfollow', type: 'error', isVisible: true });
    } finally {
      setIsUnfollowing(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    disconnectSocket();
    clearAuth();
    sessionStorage.removeItem('kartess_auth_verified');
    router.push('/login');
  };

  if (isLoading || (!user && username)) {
    return (
      <Layout title="Profile - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout title="Profile - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">User not found</p>
            <Button
              variant="outline"
              onClick={() => router.push('/home')}
              className="mt-4"
            >
              Go Home
            </Button>
          </div>
        </div>
        <BottomNav />
      </Layout>
    );
  }

  const isCurrentUser = currentUser?.id === user.id;
  const isFollowingUser = checkFollowing();
  
  // Get follower/following counts from _count
  const followersCount = user._count?.receivedContacts || 0;
  const followingCount = user._count?.sentContacts || 0;

  return (
    <Layout title={`${user.full_name || 'Profile'} - Kartess`}>
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header with Logo and Notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-4">
            <div className="flex items-center justify-between min-w-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => router.back()}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Back"
                >
                  <span className="text-gray-600 text-xl">←</span>
                </button>
                <Logo size="sm" showText={false} onClick={() => {}} />
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {isCurrentUser ? 'My Profile' : `${user.full_name || 'Profile'}`}
                </h1>
              </div>
              <div className="flex-shrink-0">
                <NotificationsBell onClick={() => setNotificationsOpen(true)} />
              </div>
            </div>
          </div>

          {/* Edit Profile and Logout Buttons (for current user) */}
          {isCurrentUser && (
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/settings')}
                  className="bg-black text-white border-black hover:bg-gray-800 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base px-3 sm:px-4"
                >
                  <span>✏️</span>
                  <span className="whitespace-nowrap">Edit Profile</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="bg-red-600 text-white border-red-600 hover:bg-red-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base px-3 sm:px-4"
                >
                  <span>🚪</span>
                  <span className="whitespace-nowrap">Logout</span>
                </Button>
              </div>
            </div>
          )}

          {/* Business Card Style Profile Card */}
          <div className="px-4 py-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                {/* Profile Picture */}
                <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {user.profile?.avatar_url ? (
                    <Image
                      src={user.profile.avatar_url}
                      alt={user.full_name || 'User'}
                      width={96}
                      height={96}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-3xl">
                      {user.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                {/* User Details */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 truncate">
                    {user.full_name || 'User'}
                  </h2>
                  <p className="text-gray-600 text-sm sm:text-base mb-1 truncate">@{user.username || 'unknown'}</p>
                  <p className="text-gray-600 text-xs sm:text-sm mb-3 truncate">{user.email}</p>
                  
                  {/* Followers/Following Counts */}
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-900">{followersCount}</span>
                      <span className="text-gray-500 ml-1">Followers</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{followingCount}</span>
                      <span className="text-gray-500 ml-1">Following</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2 min-w-0">
                {isCurrentUser ? (
                  <Button
                    variant="primary"
                    onClick={() => setIsQRGeneratorOpen(true)}
                    className="flex-1 min-w-0 text-sm sm:text-base"
                  >
                    <span className="whitespace-nowrap">📤 Share QR</span>
                  </Button>
                ) : (
                  <>
                    {isFollowing ? (
                      <Button
                        variant="outline"
                        onClick={handleUnfollow}
                        disabled={isUnfollowing}
                        className="flex-1 min-w-0 text-sm sm:text-base"
                      >
                        <span className="whitespace-nowrap">{isUnfollowing ? 'Unfollowing...' : 'Unfollow'}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => setPresetModalOpen(true)}
                        className="flex-1 min-w-0 text-sm sm:text-base"
                      >
                        <span className="whitespace-nowrap">Follow</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setIsQRScannerOpen(true)}
                      className="flex-1 min-w-0 text-sm sm:text-base"
                    >
                      <span className="whitespace-nowrap">📷 Scan QR</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Profile Information Section */}
          <div className="px-4 pb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Profile Information</h3>
              
              <div className="space-y-4">
                {/* Bio */}
                {user.profile?.bio && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Bio</label>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[100px]">
                      <p className="text-gray-700 whitespace-pre-wrap">{user.profile.bio}</p>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {user.profile?.phone && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Phone</label>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700">{user.profile.phone}</p>
                    </div>
                  </div>
                )}

                {/* Company */}
                {user.profile?.company && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Company</label>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700">{user.profile.company}</p>
                    </div>
                  </div>
                )}

                {/* Position */}
                {user.profile?.position && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Position</label>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700">{user.profile.position}</p>
                    </div>
                  </div>
                )}

                {/* Education */}
                {user.profile?.education && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Education</label>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700">{user.profile.education}</p>
                    </div>
                  </div>
                )}

                {/* Show message if no profile info */}
                {!user.profile?.bio && !user.profile?.phone && !user.profile?.company && !user.profile?.position && !user.profile?.education && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">
                      {isCurrentUser ? 'Complete your profile to share more information' : 'No additional profile information'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <BottomNav />

        {/* QR Code Generator Modal */}
        {isCurrentUser && (
          <QRGenerator
            isOpen={isQRGeneratorOpen}
            onClose={() => setIsQRGeneratorOpen(false)}
          />
        )}

        {/* QR Code Scanner Modal */}
        <QRScanner
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          onSuccess={() => {
            // Refetch contacts to update follow status
            window.location.reload();
          }}
        />

        {/* Notifications Panel */}
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />

        <PresetSelectionModal
          isOpen={presetModalOpen}
          onClose={() => setPresetModalOpen(false)}
          onSelect={(presetName) => {
            handleFollow(presetName);
            setPresetModalOpen(false);
          }}
          title="Select Preset"
          description="Choose which information you want to share with this contact:"
        />

        <ConfirmModal
          isOpen={showUnfollowConfirm}
          title="Unfollow User"
          message={`Are you sure you want to unfollow ${user?.full_name || user?.username || 'this user'}?`}
          confirmText="Unfollow"
          cancelText="Cancel"
          confirmVariant="primary"
          onConfirm={confirmUnfollow}
          onCancel={() => setShowUnfollowConfirm(false)}
        />

        <ConfirmModal
          isOpen={showLogoutConfirm}
          title="Logout"
          message="Are you sure you want to logout?"
          confirmText="Logout"
          cancelText="Cancel"
          confirmVariant="primary"
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />

        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      </Layout>
  );
}
