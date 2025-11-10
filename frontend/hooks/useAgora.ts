import { useEffect, useRef, useState } from 'react';

interface UseAgoraProps {
  appId: string;
  channel: string;
  token: string | null;
  uid: string;
  role: 'host' | 'audience';
}

export function useAgora({ appId, channel, token, uid, role }: UseAgoraProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  const setLocalAudioTrack = (track: any) => {
    localAudioTrackRef.current = track;
  };

  const setLocalVideoTrack = (track: any) => {
    localVideoTrackRef.current = track;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Don't initialize if required params are missing
    if (!appId || !channel) {
      return;
    }

    let isUnmounted = false;
    let localAudioTrackSnapshot: any = null;
    let localVideoTrackSnapshot: any = null;

    const initialize = async () => {
      const AgoraModule = await import('agora-rtc-sdk-ng');
      const AgoraRTC = AgoraModule.default ?? AgoraModule;

      if (isUnmounted) {
        return;
      }

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (user: any, mediaType: 'audio' | 'video' | 'datachannel') => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          setRemoteUsers((prev) => [...prev, user]);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video' | 'datachannel') => {
        if (mediaType === 'video') {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        }
      });

      const join = async () => {
        if (!appId || !channel || (!token && token !== null)) {
          console.warn('Agora: Missing required parameters, skipping join');
          return;
        }

        try {
          if (role === 'host') {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (permissionError) {
          console.error('Camera/mic permission denied:', permissionError);
          alert('Camera and microphone permissions are required for live streaming');
          return;
        }

        try {
          const tokenToUse = token && token.trim() !== '' ? token : null;
          await client.join(appId, channel, tokenToUse, uid);
          if (isUnmounted) return;
          setIsConnected(true);

          if (role === 'host') {
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            const videoTrack = await AgoraRTC.createCameraVideoTrack();

            await client.publish([audioTrack, videoTrack]);
            localAudioTrackSnapshot = audioTrack;
            localVideoTrackSnapshot = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);
          }
        } catch (error) {
          console.error('Failed to join channel:', error);
        }
      };

      if (!isUnmounted) {
        await join();
      }
    };

    initialize();

    return () => {
      isUnmounted = true;

      const audioTrack = localAudioTrackSnapshot ?? localAudioTrackRef.current;
      if (audioTrack) {
        audioTrack.stop();
        audioTrack.close();
      }

      const videoTrack = localVideoTrackSnapshot ?? localVideoTrackRef.current;
      if (videoTrack) {
        videoTrack.stop();
        videoTrack.close();
      }

      if (clientRef.current) {
        clientRef.current.leave().catch((err: unknown) => {
          console.error('Failed to leave Agora client:', err);
        });
      }
    };
  }, [appId, channel, token, uid, role]);

  return {
    isConnected,
    remoteUsers,
    localVideoTrack: localVideoTrackRef.current,
    client: clientRef.current,
  };
}
