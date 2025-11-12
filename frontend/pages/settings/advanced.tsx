import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import { getUser } from '../../lib/auth';
import { useRouter } from 'next/router';
import { usersAPI } from '../../lib/api';

export default function AdvancedSettings() {
  const router = useRouter();
  const currentUser = getUser();
  const queryClient = useQueryClient();

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    showEmail: false,
    allowMessages: true,
    allowFollowRequests: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newFollows: true,
    newMessages: true,
    newComments: true,
    newReactions: true,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  // Load existing settings
  const { data: settingsData, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => usersAPI.getSettings(),
  });

  // Update state when settings are loaded
  useEffect(() => {
    if (settingsData?.settings) {
      // Load privacy settings
      if (settingsData.settings.privacy) {
        setPrivacySettings({
          profileVisibility: settingsData.settings.privacy.profileVisibility || 'public',
          showEmail: settingsData.settings.privacy.showEmail || false,
          allowMessages: settingsData.settings.privacy.allowMessages !== undefined ? settingsData.settings.privacy.allowMessages : true,
          allowFollowRequests: settingsData.settings.privacy.allowFollowRequests !== undefined ? settingsData.settings.privacy.allowFollowRequests : true,
        });
      }
      // Load notification settings
      if (settingsData.settings.notifications) {
        setNotificationSettings({
          emailNotifications: settingsData.settings.notifications.emailNotifications !== undefined ? settingsData.settings.notifications.emailNotifications : true,
          pushNotifications: settingsData.settings.notifications.pushNotifications !== undefined ? settingsData.settings.notifications.pushNotifications : true,
          newFollows: settingsData.settings.notifications.newFollows !== undefined ? settingsData.settings.notifications.newFollows : true,
          newMessages: settingsData.settings.notifications.newMessages !== undefined ? settingsData.settings.notifications.newMessages : true,
          newComments: settingsData.settings.notifications.newComments !== undefined ? settingsData.settings.notifications.newComments : true,
          newReactions: settingsData.settings.notifications.newReactions !== undefined ? settingsData.settings.notifications.newReactions : true,
        });
      }
    }
  }, [settingsData]);

  // Show error toast if settings fail to load
  useEffect(() => {
    if (settingsError) {
      console.error('Failed to load settings:', settingsError);
      setToast({
        message: 'Failed to load settings. Using defaults.',
        type: 'error',
        isVisible: true,
      });
    }
  }, [settingsError]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { privacy?: any; notifications?: any }) => {
      return usersAPI.updateSettings(settings);
    },
    onSuccess: () => {
      setToast({ message: 'Settings updated successfully!', type: 'success', isVisible: true });
      // Invalidate settings query to refetch
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
    onError: (error: any) => {
      console.error('Failed to update settings:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update settings';
      setToast({ 
        message: errorMessage,
        type: 'error', 
        isVisible: true 
      });
    },
  });

  const handlePrivacySave = () => {
    updateSettingsMutation.mutate({ privacy: privacySettings });
  };

  const handleNotificationsSave = () => {
    updateSettingsMutation.mutate({ notifications: notificationSettings });
  };

  if (isLoadingSettings) {
    return (
      <Layout title="Advanced Settings - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout title="Advanced Settings - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Advanced Settings</h1>
          </div>

          <div className="px-4 py-6 space-y-6">
            {/* Privacy Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Privacy</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Visibility
                  </label>
                  <select
                    value={privacySettings.profileVisibility}
                    onChange={(e) =>
                      setPrivacySettings({
                        ...privacySettings,
                        profileVisibility: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Email</p>
                    <p className="text-xs text-gray-500">Make your email visible on profile</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacySettings.showEmail}
                      onChange={(e) =>
                        setPrivacySettings({
                          ...privacySettings,
                          showEmail: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Allow Messages</p>
                    <p className="text-xs text-gray-500">Let others message you</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacySettings.allowMessages}
                      onChange={(e) =>
                        setPrivacySettings({
                          ...privacySettings,
                          allowMessages: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <Button
                  variant="primary"
                  onClick={handlePrivacySave}
                  disabled={updateSettingsMutation.isPending}
                  className="w-full"
                >
                  {updateSettingsMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Save Privacy Settings'
                  )}
                </Button>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Notifications</h2>

              <div className="space-y-4">
                {Object.entries(notificationSettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value as boolean}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            [key]: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}

                <Button
                  variant="primary"
                  onClick={handleNotificationsSave}
                  disabled={updateSettingsMutation.isPending}
                  className="w-full"
                >
                  {updateSettingsMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Save Notification Settings'
                  )}
                </Button>
              </div>
            </div>

          </div>
        </div>

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
