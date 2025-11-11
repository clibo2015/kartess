import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { liveAPI } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useDaily } from '../../hooks/useDaily';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LiveStreamView() {
  const router = useRouter();
  const { sessionId } = router.query;
  const currentUser = getUser();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [shouldStart, setShouldStart] = useState(false);

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['liveSession', sessionId],
    queryFn: async () => {
      if (sessionId && typeof sessionId === 'string') {
        // Joining existing session
        return liveAPI.joinSession(sessionId);
      } else {
        // Creating new session (no sessionId means creating)
        return liveAPI.createSession({ type: 'live' });
      }
    },
    enabled: true, // Always enabled - will create or join based on sessionId
  });

  // Determine if user is host
  // If no sessionId, user is creating (host)
  // If sessionId exists, check if current user is the host
  const isHost = !sessionId || sessionData?.session?.host_id === currentUser?.id;

  // Only use Daily.co hook when sessionData is loaded AND user has clicked start
  // This ensures permission request happens in response to user click
  const { isConnected, isConnecting, error, needsPermission, localVideoTrack, participants, callObject, requestPermissions } = useDaily(
    sessionData && shouldStart
      ? {
          roomUrl: sessionData.roomUrl || '',
          token: sessionData.token || null,
          enableVideo: isHost, // Only enable video for hosts in live streaming
          enableAudio: isHost, // Only enable audio for hosts in live streaming
        }
      : {
          roomUrl: '',
          token: null,
          enableVideo: false,
          enableAudio: false,
        }
  );

  // Render local video track
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      const videoElement = localVideoRef.current;
      const stream = new MediaStream([localVideoTrack]);
      videoElement.srcObject = stream;
      videoElement.play().catch((err) => {
        console.error('Failed to play local video', err);
      });

      return () => {
        videoElement.srcObject = null;
      };
    }
  }, [localVideoTrack]);

  // Render remote participant video tracks
  useEffect(() => {
    participants.forEach((participant) => {
      if (participant.videoTrack) {
        const videoElement = remoteVideoRefs.current.get(participant.session_id);
        if (videoElement) {
          const stream = new MediaStream([participant.videoTrack]);
          videoElement.srcObject = stream;
          videoElement.play().catch((err) => {
            console.error('Failed to play remote video', err);
          });
        }
      }
    });
  }, [participants]);

  // Play remote audio tracks
  useEffect(() => {
    participants.forEach((participant) => {
      if (participant.audioTrack) {
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        const stream = new MediaStream([participant.audioTrack]);
        audioElement.srcObject = stream;
        audioElement.play().catch((err) => {
          console.error('Failed to play remote audio', err);
        });

        // Clean up when track stops
        participant.audioTrack.addEventListener('ended', () => {
          audioElement.remove();
        });
      }
    });
  }, [participants]);

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
        {isHost && localVideoTrack && (
          <video
            ref={localVideoRef}
            className="w-full h-screen object-cover"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Remote participants video */}
        {participants.map((participant) => (
          <video
            key={participant.session_id}
            ref={(el) => {
              if (el) {
                remoteVideoRefs.current.set(participant.session_id, el);
              } else {
                remoteVideoRefs.current.delete(participant.session_id);
              }
            }}
            className="w-full h-screen object-cover"
            autoPlay
            playsInline
          />
        ))}

        {/* Start button - show before connection */}
        {!shouldStart && sessionData && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white max-w-md mx-4">
              <h2 className="text-2xl font-bold mb-4">
                {isHost ? 'Ready to Go Live?' : 'Ready to Watch?'}
              </h2>
              <p className="text-gray-300 mb-6">
                {isHost 
                  ? 'Click the button below to start your live stream. You\'ll be asked to allow camera and microphone access.'
                  : 'Click the button below to join the live stream.'}
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setShouldStart(true);
                }}
                className="bg-red-600 px-8 py-3 text-lg"
              >
                {isHost ? '🔴 Start Streaming' : '▶️ Watch Stream'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.back()}
                className="mt-4 bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        {isConnected && (
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
                onClick={() => {
                  callObject?.leave();
                  router.back();
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        )}

        {(isConnecting || (!isConnected && !error)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white max-w-md mx-4">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-xl font-semibold">Connecting to stream...</p>
              <p className="text-sm text-gray-300 mt-2">
                {isHost 
                  ? 'Please allow camera and microphone access when prompted by your browser.'
                  : 'Loading stream...'}
              </p>
              {isHost && (
                <div className="mt-4 p-4 bg-blue-900/50 rounded-lg text-left">
                  <p className="text-sm font-semibold mb-2">If you don't see a permission prompt:</p>
                  <ol className="text-xs text-gray-300 list-decimal list-inside space-y-1">
                    <li>Check your browser's address bar for a camera/microphone icon</li>
                    <li>Click the lock icon and allow camera/microphone access</li>
                    <li>Refresh the page and try again</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white max-w-md mx-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold mb-2">
                {needsPermission ? 'Permissions Required' : 'Connection Error'}
              </h3>
              <p className="text-gray-300 mb-6">{error}</p>
              <div className="flex gap-4 justify-center flex-wrap">
                {needsPermission && (
                  <Button
                    variant="primary"
                    onClick={requestPermissions}
                    className="bg-blue-600"
                  >
                    Grant Permissions
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => window.location.reload()}
                  className="bg-blue-600"
                >
                  {needsPermission ? 'Refresh Page' : 'Try Again'}
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
