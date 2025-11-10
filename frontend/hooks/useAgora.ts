import { useEffect, useRef, useState } from 'react';

interface UseAgoraProps {
  appId: string;
  channel: string;
  token: string | null;
  uid: number | string; // Can be numeric UID or string (will be converted)
  role: 'host' | 'audience';
  enableVideo?: boolean; // Optional: enable video (default: true for host, false for audience)
  mode?: 'live' | 'rtc'; // Client mode: 'live' for interactive live streaming, 'rtc' for calls
}

export function useAgora({ appId, channel, token, uid, role, enableVideo = role === 'host', mode = 'rtc' }: UseAgoraProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
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

      // Use 'live' mode for interactive live streaming, 'rtc' for calls
      // Live mode supports host/audience roles, RTC mode is peer-to-peer
      const clientMode = mode === 'live' ? 'live' : 'rtc';
      const client = AgoraRTC.createClient({ mode: clientMode, codec: 'vp8' });
      clientRef.current = client;
      
      console.log('Agora client created', { mode: clientMode, appId, channel });

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
        if (!appId || !channel) {
          const errorMsg = 'Missing Agora configuration. Please check your environment variables.';
          console.error('Agora: Missing required parameters');
          if (!isUnmounted) {
            setError(errorMsg);
            setIsConnecting(false);
          }
          return;
        }

        if (isUnmounted) return;
        setIsConnecting(true);
        setError(null);

        // Request permissions for host role - we'll determine video/audio needs from context
        // For now, request both - the calling component can handle voice-only calls
        if (role === 'host') {
          try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error('Media devices API not available in this browser');
            }

            // Request permissions - this will prompt the user
            const stream = await navigator.mediaDevices.getUserMedia({
              video: enableVideo, // Only request video if enabled
              audio: true, // Always request audio for calls/streams
            });
            // Stop the test stream immediately - we'll create proper tracks later
            stream.getTracks().forEach((track) => track.stop());
          } catch (permissionError: any) {
            console.error('Camera/mic permission denied:', permissionError);
            const errorMsg = permissionError.name === 'NotAllowedError' 
              ? enableVideo 
                ? 'Camera and microphone permissions are required. Please allow access and try again.'
                : 'Microphone permission is required. Please allow access and try again.'
              : permissionError.name === 'NotFoundError'
              ? enableVideo
                ? 'No camera or microphone found. Please connect a device and try again.'
                : 'No microphone found. Please connect a microphone and try again.'
              : 'Failed to access device. Please check your device permissions.';
            
            if (!isUnmounted) {
              setError(errorMsg);
              setIsConnecting(false);
            }
            return;
          }
        }

        try {
          // Validate appId before joining
          if (!appId || appId.trim() === '') {
            throw new Error('Agora App ID is missing or invalid. Please check your environment variables.');
          }

          // Convert UID to number if it's a string
          const numericUID = typeof uid === 'string' ? parseInt(uid, 10) || 0 : uid;
          
          // Validate numeric UID is within Agora's range (0 to 2^32-1)
          if (numericUID < 0 || numericUID > 4294967295) {
            throw new Error('Invalid UID: must be between 0 and 4294967295');
          }

          const tokenToUse = token && token.trim() !== '' ? token : null;
          
          console.log('Joining Agora channel', { appId, channel, uid: numericUID, hasToken: !!tokenToUse, mode: clientMode });
          
          await client.join(appId, channel, tokenToUse || null, numericUID);
          
          if (isUnmounted) return;
          
          console.log('Successfully joined Agora channel', { channel, uid: numericUID, mode: clientMode });
          
          // For live mode, set client role (host can publish, audience can only subscribe)
          if (clientMode === 'live') {
            try {
              await client.setClientRole(role === 'host' ? 'host' : 'audience');
              console.log('Client role set', { role: role === 'host' ? 'host' : 'audience' });
            } catch (roleError: any) {
              console.error('Failed to set client role:', roleError);
              // Continue even if role setting fails
            }
          }
          
          // Create and publish tracks for host
          if (role === 'host') {
            try {
              const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
              const tracksToPublish: any[] = [audioTrack];
              
              // Only create video track if enabled
              if (enableVideo) {
                const videoTrack = await AgoraRTC.createCameraVideoTrack();
                tracksToPublish.push(videoTrack);
                localVideoTrackSnapshot = videoTrack;
                setLocalVideoTrack(videoTrack);
              }

              await client.publish(tracksToPublish);
              
              if (isUnmounted) {
                audioTrack.stop();
                audioTrack.close();
                if (enableVideo && localVideoTrackSnapshot) {
                  localVideoTrackSnapshot.stop();
                  localVideoTrackSnapshot.close();
                }
                return;
              }
              
              localAudioTrackSnapshot = audioTrack;
              setLocalAudioTrack(audioTrack);
            } catch (trackError: any) {
              console.error('Failed to create/publish tracks:', trackError);
              await client.leave();
              if (!isUnmounted) {
                const errorMsg = enableVideo 
                  ? trackError.message || 'Failed to start camera/microphone'
                  : trackError.message || 'Failed to start microphone';
                setError(errorMsg);
                setIsConnecting(false);
              }
              return;
            }
          }

          if (!isUnmounted) {
            setIsConnected(true);
            setIsConnecting(false);
          }
        } catch (error: any) {
          console.error('Failed to join channel:', error);
          if (!isUnmounted) {
            setError(error.message || 'Failed to connect to the stream. Please try again.');
            setIsConnecting(false);
          }
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
  }, [appId, channel, token, uid, role, enableVideo, mode]);

  return {
    isConnected,
    isConnecting,
    error,
    remoteUsers,
    localVideoTrack: localVideoTrackRef.current,
    client: clientRef.current,
  };
}
