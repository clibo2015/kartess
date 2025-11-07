import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { getUser } from '../lib/auth';

interface MoreOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Option {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string | null;
  onClick?: () => void;
}

export default function MoreOptionsPanel({ isOpen, onClose }: MoreOptionsPanelProps) {
  const router = useRouter();
  const user = getUser();

  const options: Option[] = [
    {
      id: 'connect',
      label: 'Connect',
      icon: '👥',
      color: 'bg-blue-500',
      route: user?.username ? `/${user.username}/connect` : null,
    },
    {
      id: 'visuals',
      label: 'Visuals',
      icon: '📷',
      color: 'bg-purple-500',
      route: user?.username ? `/${user.username}/visuals` : null,
    },
    {
      id: 'reels',
      label: 'Reels',
      icon: '▶️',
      color: 'bg-pink-500',
      route: '/reels',
    },
    {
      id: 'threads',
      label: 'Threads',
      icon: '#',
      color: 'bg-teal-500',
      route: user?.username ? `/${user.username}/threads` : null,
    },
    {
      id: 'careernet',
      label: 'CareerNet',
      icon: '💼',
      color: 'bg-blue-600',
      route: '/careernet',
    },
    {
      id: 'live',
      label: 'Live',
      icon: '📹',
      color: 'bg-red-500',
      route: '/live',
    },
    {
      id: 'stories',
      label: 'Stories',
      icon: '📸',
      color: 'bg-yellow-500',
      route: '/stories',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: '🔔',
      color: 'bg-orange-500',
      route: '/notifications',
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: '👥',
      color: 'bg-teal-600',
      route: '/contacts',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '👤',
      color: 'bg-gray-500',
      route: '/settings',
    },
  ];

  const handleOptionClick = (option: Option) => {
    if (option.onClick) {
      option.onClick();
      onClose();
    } else if (option.route) {
      // Navigate to the route - don't call onClose() here
      // The route change event in more.tsx will handle closing the panel
      // This prevents the redirect to /home that happens in onClose()
      router.push(option.route);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl z-50 shadow-2xl safe-area-bottom max-h-[80vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">More Options</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <span className="text-gray-600 dark:text-gray-400 text-xl">×</span>
              </button>
            </div>

            {/* Options Grid */}
            <div className="px-4 pb-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-2 gap-3">
                {options.map((option, index) => (
                  <motion.button
                    key={option.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    onClick={() => handleOptionClick(option)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 transition-colors touch-manipulation min-h-[100px]"
                  >
                    <div
                      className={`w-14 h-14 ${option.color} rounded-xl flex items-center justify-center mb-2 shadow-sm`}
                    >
                      <span className="text-2xl text-white">{option.icon}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center">
                      {option.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

