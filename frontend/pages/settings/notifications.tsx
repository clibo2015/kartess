import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import Logo from '../../components/Logo';
import { getToken } from '../../lib/auth';

export default function NotificationSettings() {
  const router = useRouter();

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newFollows: true,
    newMessages: true,
    newComments: true,
    newReactions: true,
    newMentions: true,
    postUpdates: true,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ notifications: settings }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      alert('Notification settings updated successfully!');
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(notificationSettings);
  };

  return (
    <Layout title="Notification Settings - Kartess">
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
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            </div>
            <p className="text-sm text-gray-500">
              Configure how and when you receive notifications
            </p>
          </div>

          <div className="px-4 py-6 space-y-6">
            {/* Notification Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Notification Preferences</h2>

              <div className="space-y-4">
                {Object.entries(notificationSettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2">
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
                  onClick={handleSave}
                  disabled={updateSettingsMutation.isPending}
                  className="w-full mt-4"
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

        <BottomNav />
      </Layout>
  );
}

