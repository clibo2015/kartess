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

  // Only use Daily.co hook when sessionData is loaded
  const { isConnected, isConnecting, error, localVideoTrack, participants, callObject } = useDaily(
    sessionData
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
              onClick={() => {
                callObject?.leave();
                router.back();
              }}
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
