import { useEffect, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

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
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    // Don't initialize if required params are missing
    if (!appId || !channel) {
      return;
    }

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    client.on('user-published', async (user: any, mediaType: string) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers((prev) => [...prev, user]);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });

    client.on('user-unpublished', (user: any, mediaType: string) => {
      if (mediaType === 'video') {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      }
    });

    const join = async () => {
      // Don't join until all required params are valid
      if (!appId || !channel || (!token && token !== null)) {
        console.warn('Agora: Missing required parameters, skipping join');
        return;
      }

      // Request camera/mic permissions before joining
      try {
        if (role === 'host') {
          // Request permissions first
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          // Stop the test stream immediately
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (permissionError) {
        console.error('Camera/mic permission denied:', permissionError);
        alert('Camera and microphone permissions are required for live streaming');
        return;
      }

      try {
        // Use null instead of empty string if token is empty
        const tokenToUse = token && token.trim() !== '' ? token : null;
        await client.join(appId, channel, tokenToUse, uid);
        setIsConnected(true);

        if (role === 'host') {
          // Host publishes audio/video
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          const videoTrack = await AgoraRTC.createCameraVideoTrack();
          
          await client.publish([audioTrack, videoTrack]);
          setLocalAudioTrack(audioTrack);
          setLocalVideoTrack(videoTrack);
        }
      } catch (error) {
        console.error('Failed to join channel:', error);
      }
    };

    // Only join if we have valid parameters
    if (appId && channel && (token || token === null)) {
      join();
    }

    return () => {
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      client.leave();
    };
  }, [appId, channel, token, uid, role]);

  return {
    isConnected,
    remoteUsers,
    localVideoTrack,
    client: clientRef.current,
  };
}
