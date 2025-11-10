import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { liveAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useAgora } from '../../hooks/useAgora';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LiveStreamView() {
  const router = useRouter();
  const { sessionId } = router.query;
  const currentUser = getUser();
  const localVideoRef = useRef<HTMLDivElement>(null);

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['liveSession', sessionId],
    queryFn: async () => {
      if (!sessionId) {
        // Creating new session
        return liveAPI.createSession({ type: 'live' });
      } else {
        // Joining existing session
        return liveAPI.joinSession(sessionId as string);
      }
    },
    enabled: !!sessionId || !sessionId, // Enable for both cases
  });

  // Determine if user is host
  const isHost = sessionData?.session?.host_id === currentUser?.id || !sessionId;

  // Only use Agora hook when sessionData is loaded
  const { isConnected, isConnecting, error, localVideoTrack, remoteUsers } = useAgora(
    sessionData
      ? {
          appId: sessionData.appId || '',
          channel: sessionData.channel || '',
          token: sessionData.token || null,
          uid: sessionData.uid || 0, // Use numeric UID from backend
          role: isHost ? 'host' : 'audience',
          enableVideo: isHost, // Always enable video for live streaming hosts
          mode: sessionData.mode || 'live', // Use mode from backend (live for streaming)
        }
      : {
          appId: '',
          channel: '',
          token: null,
          uid: 0,
          role: 'audience',
          enableVideo: false,
          mode: 'live',
        }
  );

  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack]);

  const endSessionMutation = useMutation({
    mutationFn: () => liveAPI.endSession(sessionId as string),
    onSuccess: () => {
      router.push('/live');
    },
  });

  if (isLoading) {
    return (
      <Layout title="Live Stream - Kartess">
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Live Stream - Kartess">
        <div className="min-h-screen bg-black relative">
          {/* Host video */}
          {isHost && localVideoRef && (
            <div
              ref={localVideoRef}
              className="w-full h-screen"
              style={{ minHeight: '100vh' }}
            />
          )}

          {/* Remote users */}
          {remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="w-full h-screen"
              ref={(el) => {
                if (el && user.videoTrack) {
                  user.videoTrack.play(el);
                }
              }}
            />
          ))}

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex items-center justify-center gap-4">
              {isHost && (
                <Button
                  variant="primary"
                  onClick={() => endSessionMutation.mutate()}
                  className="bg-red-600"
                >
                  End Stream
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => router.back()}
              >
                Leave
              </Button>
            </div>
          </div>

          {(isConnecting || (!isConnected && !error)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <LoadingSpinner size="lg" />
                <p className="mt-4">Connecting to stream...</p>
                <p className="text-sm text-gray-300 mt-2">Please allow camera and microphone access</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white max-w-md mx-4">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold mb-2">Connection Error</h3>
                <p className="text-gray-300 mb-6">{error}</p>
                <div className="flex gap-4 justify-center">
                  <Button
                    variant="primary"
                    onClick={() => window.location.reload()}
                    className="bg-blue-600"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push('/live')}
                    className="bg-gray-600"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
  );
}
