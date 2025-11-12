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
            staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh for 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time (formerly cacheTime)
            refetchOnWindowFocus: false, // Don't refetch when window regains focus
            refetchOnMount: false, // Don't refetch on mount if data is fresh
            refetchOnReconnect: false, // Don't refetch on reconnect - rely on Socket.io for real-time updates
            retry: 1, // Only retry once on failure
            networkMode: 'online', // Only run queries when online
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

  // Set up Socket.io for incoming calls and notifications
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const currentUser = getUser();
    if (!currentUser?.id) return;

    const socket = getSocket();
    
    // Join user room for notifications and calls
    socket.emit('join:user', currentUser.id);

    // Listen for incoming calls
    const handleCallIncoming = (callData: any) => {
      setIncomingCall(callData);
      setCallAccepted(false);
      setCallRejected(false);
    };

    // Listen for call accepted
    const handleCallAccepted = (data: any) => {
      setIncomingCall((prev: any) => {
        if (prev?.sessionId === data.sessionId) {
          setCallAccepted(true);
          return prev;
        }
        return prev;
      });
    };

    // Listen for call rejected
    const handleCallRejected = (data: any) => {
      setIncomingCall((prev: any) => {
        if (prev?.sessionId === data.sessionId) {
          setCallRejected(true);
          return null;
        }
        return prev;
      });
    };

    // Listen for call ended
    const handleCallEnded = (data: any) => {
      setIncomingCall((prev: any) => {
        if (prev?.sessionId === data.sessionId) {
          setCallAccepted(false);
          setCallRejected(false);
          return null;
        }
        return prev;
      });
    };

    // Listen for live stream started (from contacts)
    const handleLiveStreamStarted = (data: any) => {
      // Show notification or update UI when a contact starts a live stream
      console.log('Live stream started:', data);
      // The notification system should handle this via Socket.io
    };

    socket.on('call.incoming', handleCallIncoming);
    socket.on('call.accepted', handleCallAccepted);
    socket.on('call.rejected', handleCallRejected);
    socket.on('call.ended', handleCallEnded);
    socket.on('live.stream.started', handleLiveStreamStarted);

    return () => {
      socket.off('call.incoming', handleCallIncoming);
      socket.off('call.accepted', handleCallAccepted);
      socket.off('call.rejected', handleCallRejected);
      socket.off('call.ended', handleCallEnded);
      socket.off('live.stream.started', handleLiveStreamStarted);
    };
  }, []); // Remove incomingCall from dependencies to avoid re-subscribing

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
