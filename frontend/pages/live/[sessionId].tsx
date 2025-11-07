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
  const { isConnected, localVideoTrack, remoteUsers } = useAgora(
    sessionData
      ? {
          appId: sessionData.appId || '',
          channel: sessionData.channel || '',
          token: sessionData.token || null,
          uid: sessionData.uid || currentUser?.id || '',
          role: isHost ? 'host' : 'audience',
        }
      : {
          appId: '',
          channel: '',
          token: null,
          uid: '',
          role: 'audience',
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

          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-white">Connecting...</p>
            </div>
          )}
        </div>
      </Layout>
  );
}
