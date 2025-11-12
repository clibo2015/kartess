import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';
import { getUser } from '../lib/auth';
import { useDarkMode } from '../contexts/DarkModeContext';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

export default function Settings() {
  const router = useRouter();
  const user = getUser();
  const { isDark, toggleDarkMode } = useDarkMode();

  const settingsSections: SettingsSection[] = [
    {
      id: 'profile',
      title: 'Edit Profile',
      description: 'Update your bio, avatar, and personal information',
      icon: '👤',
      route: '/settings/profile-edit',
      color: 'bg-blue-500',
    },
    {
      id: 'presets',
      title: 'Visibility Presets',
      description: 'Control what information you share with contacts',
      icon: '🔒',
      route: '/settings/presets',
      color: 'bg-purple-500',
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      description: 'Manage your privacy settings and account security',
      icon: '🛡️',
      route: '/settings/advanced',
      color: 'bg-green-500',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure how and when you receive notifications',
      icon: '🔔',
      route: '/settings/notifications',
      color: 'bg-orange-500',
    },
    {
      id: 'account',
      title: 'Account Settings',
      description: 'Manage your account preferences and data',
      icon: '⚙️',
      route: '/settings/account',
      color: 'bg-gray-500',
    },
  ];

  return (
    <Layout title="Settings - Kartess">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6">
            <div className="flex items-center gap-3 mb-2">
              <Logo size="sm" showText={false} onClick={() => {}} />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your account and preferences
            </p>
          </div>

          {/* Dark Mode Toggle */}
          <div className="px-4 py-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-800 dark:bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-xl">{isDark ? '🌙' : '☀️'}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Dark Mode
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isDark ? 'Currently enabled' : 'Currently disabled'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isDark ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="px-4 py-6 space-y-3">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => router.push(section.route)}
                className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow active:bg-gray-50 dark:active:bg-gray-700 touch-manipulation"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 ${section.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <span className="text-2xl">{section.icon}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {section.description}
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 text-xl">›</span>
                </div>
              </button>
            ))}
          </div>

          {/* User Info */}
          <div className="px-4 pb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{user?.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{user?.username}</p>
                </div>
                {user?.role === 'admin' && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
