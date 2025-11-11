import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../../components/Layout';
import { liveAPI } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { useDaily } from '../../../hooks/useDaily';
import { getSocket } from '../../../lib/socket';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function CallView() {
  const router = useRouter();
  const { threadId, type, sessionId } = router.query;
  const currentUser = getUser();
  const queryClient = useQueryClient();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [isInCall, setIsInCall] = useState(false);
  const [shouldStart, setShouldStart] = useState(false);
  const [callStatus, setCallStatus] = useState<'ringing' | 'accepted' | 'rejected' | 'ended' | null>(null);

  const callMode =
    typeof type === 'string'
      ? type
      : Array.isArray(type)
      ? type[0]
      : 'voice';

  const isVideo = callMode === 'video';
  const callType = isVideo ? 'video' : 'voice';

  // If sessionId is provided, join existing session (call was accepted)
  // Otherwise, create new session (initiating call)
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['callSession', threadId, type, sessionId],
    queryFn: async () => {
      if (sessionId && typeof sessionId === 'string') {
        // Joining existing accepted call
        return liveAPI.joinSession(sessionId);
      } else {
        // Creating new call - this will send notification to other participant
        return liveAPI.createSession({
          type: callType,
          title: `Call with thread ${threadId}`,
          thread_id: threadId as string, // Pass thread_id for call notifications
        });
      }
    },
    enabled: !!threadId,
  });

  // Listen for call status updates via Socket.io
  useEffect(() => {
    if (!threadId || typeof window === 'undefined') return;

    const socket = getSocket();

    // Listen for call accepted
    socket.on('call.accepted', (data: any) => {
      if (sessionData?.session?.id === data.sessionId) {
        setCallStatus('accepted');
        // Auto-start the call when accepted
        if (!shouldStart) {
          setShouldStart(true);
        }
      }
    });

    // Listen for call rejected
    socket.on('call.rejected', (data: any) => {
      if (sessionData?.session?.id === data.sessionId) {
        setCallStatus('rejected');
        // Show rejection message and go back
        setTimeout(() => {
          router.push(`/chats/${threadId}`);
        }, 2000);
      }
    });

    // Listen for call ended
    socket.on('call.ended', (data: any) => {
      if (sessionData?.session?.id === data.sessionId) {
        setCallStatus('ended');
        // Navigate back after a delay
        setTimeout(() => {
          router.push(`/chats/${threadId}`);
        }, 1000);
      }
    });

    return () => {
      socket.off('call.accepted');
      socket.off('call.rejected');
      socket.off('call.ended');
    };
  }, [threadId, sessionData, shouldStart, router]);

  // Only start Daily.co when user clicks the start button
  // This ensures permission request happens in response to user click
  const { isConnected, isConnecting, error, needsPermission, localVideoTrack, participants, callObject, requestPermissions } = useDaily(
    sessionData && shouldStart
      ? {
          roomUrl: sessionData.roomUrl || '',
          token: sessionData.token || null,
          enableVideo: isVideo, // Enable video only for video calls
          enableAudio: true, // Always enable audio for calls
        }
      : {
          roomUrl: '',
          token: null,
          enableVideo: isVideo,
          enableAudio: true,
        }
  );

  // Render local video track
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && isVideo) {
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
  }, [localVideoTrack, isVideo]);

  // Render remote participant video tracks
  useEffect(() => {
    if (!isVideo) return;

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
  }, [participants, isVideo]);

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

  useEffect(() => {
    setIsInCall(isConnected);
  }, [isConnected]);

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
        {isVideo && localVideoTrack && isInCall && (
          <video
            ref={localVideoRef}
            className="w-full h-screen object-cover"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Remote participants video */}
        {isVideo && participants.map((participant) => (
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
        {!shouldStart && sessionData && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center text-white max-w-md mx-4">
              {callStatus === 'ringing' ? (
                <>
                  <div className="animate-pulse mb-6">
                    <div className="text-6xl mb-4">📞</div>
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Calling...</h2>
                  <p className="text-gray-300 mb-6">Waiting for the other party to answer</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (sessionData?.session?.id) {
                        liveAPI.endSession(sessionData.session.id);
                      }
                      router.back();
                    }}
                    className="bg-red-600 z-10 relative"
                  >
                    Cancel Call
                  </Button>
                </>
              ) : callStatus === 'rejected' ? (
                <>
                  <div className="text-6xl mb-4">❌</div>
                  <h2 className="text-2xl font-bold mb-4">Call Rejected</h2>
                  <p className="text-gray-300 mb-6">The other party declined your call</p>
                  <Button
                    variant="primary"
                    onClick={() => router.back()}
                    className="bg-gray-600 z-10 relative"
                  >
                    Go Back
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-4">
                    {isVideo ? 'Start Video Call?' : 'Start Voice Call?'}
                  </h2>
                  <p className="text-gray-300 mb-6">
                    {isVideo 
                      ? 'Click the button below to start the video call. You\'ll be asked to allow camera and microphone access.'
                      : 'Click the button below to start the voice call. You\'ll be asked to allow microphone access.'}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShouldStart(true);
                      setCallStatus('ringing');
                    }}
                    className={`px-8 py-3 text-lg z-10 relative ${isVideo ? 'bg-blue-600' : 'bg-green-600'}`}
                  >
                    {isVideo ? '📹 Start Video Call' : '📞 Start Voice Call'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.back()}
                    className="mt-4 bg-gray-600 z-10 relative"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Connecting overlay - only show after start button is clicked */}
        {shouldStart && (isConnecting || (!isConnected && !error)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
            <div className="text-center text-white max-w-md mx-4">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-xl font-semibold">Connecting to call...</p>
              <p className="text-sm text-gray-300 mt-2">
                {isVideo 
                  ? 'Please allow camera and microphone access when prompted by your browser.'
                  : 'Please allow microphone access when prompted by your browser.'}
              </p>
              <div className="mt-4 p-4 bg-blue-900/50 rounded-lg text-left">
                <p className="text-sm font-semibold mb-2">If you don't see a permission prompt:</p>
                <ol className="text-xs text-gray-300 list-decimal list-inside space-y-1">
                  <li>Check your browser's address bar for a camera/microphone icon</li>
                  <li>Click the lock icon and allow camera/microphone access</li>
                  <li>Refresh the page and try again</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        {isConnected && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 z-30">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="primary"
                onClick={() => {
                  endCallMutation.mutate();
                  callObject?.leave();
                }}
                className="bg-red-600"
              >
                End Call
              </Button>
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

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center text-white max-w-md mx-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold mb-2">
                {needsPermission ? 'Permissions Required' : 'Call Error'}
              </h3>
              <p className="text-gray-300 mb-6">{error}</p>
              <div className="flex gap-4 justify-center flex-wrap">
                {needsPermission && (
                  <Button
                    variant="primary"
                    onClick={requestPermissions}
                    className="bg-blue-600 z-10 relative"
                  >
                    Grant Permissions
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 z-10 relative"
                >
                  {needsPermission ? 'Refresh Page' : 'Try Again'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/chats/${threadId}`)}
                  className="bg-gray-600 z-10 relative"
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
                {currentUser?.full_name?.charAt(0) || 'U'}
              </div>
              <p className="text-xl font-semibold">{currentUser?.full_name || 'User'}</p>
              <p className="text-gray-400">Voice Call</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
