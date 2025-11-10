import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../../components/Layout';
import { liveAPI } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { useAgora } from '../../../hooks/useAgora';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function CallView() {
  const router = useRouter();
  const { threadId, type } = router.query;
  const currentUser = getUser();
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [isInCall, setIsInCall] = useState(false);

  const callMode =
    typeof type === 'string'
      ? type
      : Array.isArray(type)
      ? type[0]
      : 'voice';

  const isVideo = callMode === 'video';
  const callType = isVideo ? 'video' : 'voice';

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['callSession', threadId, type],
    queryFn: async () => {
      return liveAPI.createSession({
        type: callType,
        title: `Call with thread ${threadId}`,
      });
    },
    enabled: !!threadId,
  });

  const { isConnected, isConnecting, error, localVideoTrack, remoteUsers } = useAgora(
    sessionData
      ? {
          appId: sessionData.appId || '',
          channel: sessionData.channel || '',
          token: sessionData.token || null,
          uid: sessionData.uid || 0, // Use numeric UID from backend
          role: 'host',
          enableVideo: isVideo, // Enable video only for video calls
          mode: sessionData.mode || 'rtc', // Use RTC mode for calls
        }
      : {
          appId: '',
          channel: '',
          token: null,
          uid: 0,
          role: 'host',
          enableVideo: isVideo,
          mode: 'rtc', // RTC mode for calls
        }
  );

  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && isVideo) {
      localVideoTrack.play(localVideoRef.current);
    }
    setIsInCall(isConnected);
  }, [localVideoTrack, isConnected, isVideo]);

  const endCallMutation = useMutation({
    mutationFn: () => liveAPI.endSession(sessionData?.session?.id || ''),
    onSuccess: () => {
      router.push(`/chats/${threadId}`);
    },
  });

  if (isLoading) {
    return (
      <Layout title="Call - Kartess">
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`${isVideo ? 'Video' : 'Voice'} Call - Kartess`}>
        <div className="min-h-screen bg-black relative">
          {/* Local video (host) */}
          {isVideo && localVideoRef && isInCall && (
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
                if (el && user.videoTrack && isVideo) {
                  user.videoTrack.play(el);
                }
              }}
            />
          ))}

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="primary"
                onClick={() => endCallMutation.mutate()}
                className="bg-red-600"
              >
                End Call
              </Button>
              <Button variant="secondary" onClick={() => router.back()}>
                Leave
              </Button>
            </div>
          </div>

          {(isConnecting || (!isConnected && !error)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <LoadingSpinner size="lg" />
                <p className="mt-4">Connecting...</p>
                <p className="text-sm text-gray-300 mt-2">
                  {isVideo ? 'Please allow camera and microphone access' : 'Please allow microphone access'}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white max-w-md mx-4">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold mb-2">Call Error</h3>
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
                    onClick={() => router.push(`/chats/${threadId}`)}
                    className="bg-gray-600"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isVideo && isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-32 h-32 rounded-full bg-blue-600 mx-auto mb-4 flex items-center justify-center text-4xl">
                  {currentUser?.full_name.charAt(0)}
                </div>
                <p className="text-xl font-semibold">{currentUser?.full_name}</p>
                <p className="text-gray-400">Voice Call</p>
              </div>
            </div>
          )}
        </div>
      </Layout>
  );
}
