import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import MoreOptionsPanel from '../components/MoreOptionsPanel';
import NotificationsBell from '../components/NotificationsBell';
import NotificationsPanel from '../components/NotificationsPanel';
import Logo from '../components/Logo';
import { clearAuth, getUser } from '../lib/auth';

export default function More() {
  const router = useRouter();
  const user = getUser();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true); // Panel opens by default when on /more page
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authVerifiedRef = useRef(false); // Track if auth was verified in this session

  // Track auth verification in sessionStorage to prevent re-checking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if auth was already verified in this session
      const authVerified = sessionStorage.getItem('kartess_auth_verified') === 'true';
      if (authVerified) {
        authVerifiedRef.current = true;
      }
    }
  }, []);

  // Close panel when navigating away
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      // Clear any pending close timeout when navigation starts
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      // Close panel immediately when navigation starts (if navigating away from /more)
      if (url !== '/more' && !url.startsWith('/more?')) {
        setPanelOpen(false);
      }
    };
    
    const handleRouteChangeComplete = () => {
      // Ensure panel is closed after route change completes
      setPanelOpen(false);
    };
    
    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      // Clear timeout on unmount
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  return (
    <Layout title="More - Kartess">
        {/* Main content - blurred when panel is open */}
        <div className={`min-h-screen bg-gray-50 pb-20 transition-opacity ${panelOpen ? 'opacity-30' : 'opacity-100'}`}>
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo size="sm" showText={false} onClick={() => {}} />
                <h1 className="text-2xl font-bold text-gray-900">More</h1>
              </div>
              <NotificationsBell onClick={() => setNotificationsOpen(true)} />
            </div>
          </div>

          {/* Placeholder content - panel will overlay this */}
          <div className="px-4 py-4">
            <p className="text-gray-500 text-center mt-8">
              Tap the More tab again or select an option from the panel
            </p>
          </div>
        </div>

        <BottomNav />

        {/* More Options Panel */}
        <MoreOptionsPanel
          isOpen={panelOpen}
          onClose={() => {
            setPanelOpen(false);
            // Clear any existing timeout
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
            }
            // Only navigate back to home if we're still on /more page and user manually closed
            // Check with a longer delay to ensure route change has completed
            closeTimeoutRef.current = setTimeout(() => {
              // Only redirect if we're still on /more (user closed panel without navigating)
              // Check if router is ready and we haven't navigated away
              if (router.isReady && router.pathname === '/more') {
                router.push('/home');
              }
              closeTimeoutRef.current = null;
            }, 500);
          }}
        />

        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      </Layout>
  );
}
