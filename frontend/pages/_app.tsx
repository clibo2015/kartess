import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import '../styles/globals.css';
import '../styles/masonry.css';
import { registerServiceWorker, requestNotificationPermission } from '../lib/pushNotifications';
import { getToken, clearAuth } from '../lib/auth';
import { authAPI } from '../lib/api';
import { DarkModeProvider } from '../contexts/DarkModeContext';

// Initialize Sentry for client-side
if (typeof window !== 'undefined' && process.env.SENTRY_DSN) {
  import('../sentry.client.config');
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    // Validate token on app load - clear if expired/invalid
    const validateTokenOnLoad = async () => {
      if (typeof window === 'undefined') return;
      
      const token = getToken();
      if (!token) {
        // No token, clear any stale auth data
        clearAuth();
        sessionStorage.removeItem('kartess_auth_verified');
        return;
      }

      try {
        // Verify token with backend
        await authAPI.verify();
        // Token is valid, mark as verified in session
        sessionStorage.setItem('kartess_auth_verified', 'true');
      } catch (error) {
        // Token is invalid or expired, clear auth data
        clearAuth();
        sessionStorage.removeItem('kartess_auth_verified');
      }
    };

    // Run token validation on app load
    validateTokenOnLoad();

    // Register service worker and request push notification permission
    if (typeof window !== 'undefined') {
      // Delay service worker registration to avoid blocking initial render
      setTimeout(() => {
        requestNotificationPermission().catch(console.error).then((granted) => {
          if (granted) {
            registerServiceWorker().catch(console.error);
          }
        });
      }, 1000);
    }
  }, []);

  return (
    <DarkModeProvider>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </DarkModeProvider>
  );
}
