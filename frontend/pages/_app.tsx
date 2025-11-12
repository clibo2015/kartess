import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import '../styles/globals.css';
import '../styles/masonry.css';
import { registerServiceWorker, requestNotificationPermission } from '../lib/pushNotifications';
import { getToken, clearAuth, getUser } from '../lib/auth';
import { authAPI } from '../lib/api';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import { getSocket } from '../lib/socket';
import IncomingCallNotification from '../components/IncomingCallNotification';

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
            gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time (formerly cacheTime)
            refetchOnWindowFocus: false,
            refetchOnMount: false, // Don't refetch on mount if data is fresh
            retry: 1, // Only retry once on failure
          },
        },
      })
  );

  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callRejected, setCallRejected] = useState(false);

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

  // Set up Socket.io for incoming calls
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const currentUser = getUser();
    if (!currentUser?.id) return;

    const socket = getSocket();
    
    // Join user room for notifications
    socket.emit('join:user', currentUser.id);

    // Listen for incoming calls
    socket.on('call.incoming', (callData: any) => {
      setIncomingCall(callData);
      setCallAccepted(false);
      setCallRejected(false);
    });

    // Listen for call accepted
    socket.on('call.accepted', (data: any) => {
      if (incomingCall?.sessionId === data.sessionId) {
        // Call was accepted, can navigate or show message
        setCallAccepted(true);
      }
    });

    // Listen for call rejected
    socket.on('call.rejected', (data: any) => {
      if (incomingCall?.sessionId === data.sessionId) {
        setCallRejected(true);
        setIncomingCall(null);
      }
    });

    // Listen for call ended
    socket.on('call.ended', (data: any) => {
      if (incomingCall?.sessionId === data.sessionId) {
        setIncomingCall(null);
        setCallAccepted(false);
        setCallRejected(false);
      }
    });

    // Listen for live stream started (from contacts)
    socket.on('live.stream.started', (data: any) => {
      // Show notification or update UI when a contact starts a live stream
      console.log('Live stream started:', data);
      // You can add a notification here if needed
      // For now, we'll just log it - the notification system should handle this
    });

    return () => {
      socket.off('call.incoming');
      socket.off('call.accepted');
      socket.off('call.rejected');
      socket.off('call.ended');
      socket.off('live.stream.started');
    };
  }, [incomingCall]);

  const handleCallAccept = () => {
    setIncomingCall(null);
    setCallAccepted(true);
  };

  const handleCallReject = () => {
    setIncomingCall(null);
    setCallRejected(true);
  };

  return (
    <DarkModeProvider>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
        {/* Incoming Call Notification */}
        {incomingCall && !callAccepted && !callRejected && (
          <IncomingCallNotification
            call={incomingCall}
            onAccept={handleCallAccept}
            onReject={handleCallReject}
          />
        )}
      </QueryClientProvider>
    </DarkModeProvider>
  );
}
