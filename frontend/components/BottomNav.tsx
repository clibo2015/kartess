import { useRouter } from 'next/router';
import Link from 'next/link';
import { getUser } from '../lib/auth';

export default function BottomNav() {
  const router = useRouter();
  const user = getUser();

  const navItems = [
    { href: '/home', icon: '🏠', label: 'Home' },
    { href: '/search', icon: '🔍', label: 'Search' },
    { href: '/chats', icon: '💬', label: 'Messages' },
    { href: user?.username ? `/${user.username}/profile` : '/home', icon: '👤', label: 'Profile' },
    { href: '/more', icon: '⋯', label: 'More', isMore: true },
  ];

  const isActive = (href: string) => {
    if (href.includes('/profile')) {
      return router.pathname === '/[username]/profile';
    }
    return router.pathname === href || router.pathname.startsWith(href);
  };

  const handleMoreClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    // If already on /more page, toggle panel by navigating away and back
    // Otherwise, just navigate to /more
    if (router.pathname === '/more') {
      // Panel should already be open, so clicking again should close it
      // The more.tsx page handles this via the panel's onClose
      router.push('/home');
    } else {
      // Navigate to /more page which will show the panel
      router.push('/more');
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          // Handle More button specially
          if (item.isMore) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleMoreClick(e, item.href)}
                className={`flex flex-col items-center justify-center flex-1 h-full ${
                  isActive(item.href)
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                } transition-colors touch-manipulation`}
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          }

          // Regular nav items use Link
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive(item.href)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              } transition-colors touch-manipulation`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
