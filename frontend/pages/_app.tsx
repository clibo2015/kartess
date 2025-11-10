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
            staleTime: 5 * 60 * 1000, // 5 minutes - increased to reduce refetches
            cacheTime: 10 * 60 * 1000, // 10 minutes cache
            refetchOnWindowFocus: false,
            refetchOnMount: false, // Don't refetch on mount if data is fresh
            retry: 1, // Only retry once on failure
          },
        },
      })
  );

  useEffect(() => {
    // Validate token on app load - defer to avoid blocking initial render
    const validateTokenOnLoad = async () => {
      if (typeof window === 'undefined') return;
      
      const token = getToken();
      if (!token) {
        // No token, clear any stale auth data
        clearAuth();
        sessionStorage.removeItem('kartess_auth_verified');
        return;
      }

      // Check if already verified in this session
      if (sessionStorage.getItem('kartess_auth_verified') === 'true') {
        return; // Skip verification if already verified
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

    // Defer token validation to avoid blocking initial render
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(validateTokenOnLoad, { timeout: 3000 });
    } else {
      setTimeout(validateTokenOnLoad, 100);
    }

    // Register service worker and request push notification permission
    // Defer to avoid blocking initial render - use requestIdleCallback if available
    if (typeof window !== 'undefined') {
      const registerServiceWorkerDeferred = () => {
        requestNotificationPermission().catch(console.error).then((granted) => {
          if (granted) {
            registerServiceWorker().catch(console.error);
          }
        });
      };

      // Use requestIdleCallback for better performance, fallback to setTimeout
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(registerServiceWorkerDeferred, { timeout: 5000 });
      } else {
        setTimeout(registerServiceWorkerDeferred, 2000);
      }
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
