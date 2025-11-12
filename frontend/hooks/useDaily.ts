import { useEffect, useRef, useState, useCallback } from 'react';

interface UseDailyProps {
  roomUrl: string;
  token: string | null;
  enableVideo?: boolean; // Optional: enable video (default: true)
  enableAudio?: boolean; // Optional: enable audio (default: true)
}

interface DailyParticipant {
  session_id: string;
  user_name?: string;
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  local?: boolean;
}

export function useDaily({ roomUrl, token, enableVideo = true, enableAudio = true }: UseDailyProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [participants, setParticipants] = useState<Map<string, DailyParticipant>>(new Map());
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const callObjectRef = useRef<any>(null);

  // Helper function to handle permission errors
  const handlePermissionError = useCallback((permissionError: any, enableVideo: boolean, enableAudio: boolean) => {
    let errorMsg = 'Failed to access media devices.';
    
    if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
      errorMsg = enableVideo
        ? 'Camera and microphone permissions were denied. Please click the lock icon in your browser\'s address bar, allow camera and microphone access, and refresh the page.'
        : 'Microphone permission was denied. Please click the lock icon in your browser\'s address bar, allow microphone access, and refresh the page.';
      setNeedsPermission(true);
    } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
      errorMsg = enableVideo
        ? 'No camera or microphone found. Please connect a camera and microphone and try again.'
        : 'No microphone found. Please connect a microphone and try again.';
    } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
      errorMsg = 'Camera or microphone is already in use by another application. Please close other applications using your camera/microphone and try again.';
    } else if (permissionError.name === 'OverconstrainedError' || permissionError.name === 'ConstraintNotSatisfiedError') {
      errorMsg = 'Camera or microphone does not meet the required specifications. Please try with a different device.';
    } else if (permissionError.name === 'AbortError') {
      errorMsg = 'Permission request was aborted. Please try again.';
    } else if (permissionError.message) {
      errorMsg = `Failed to access media devices: ${permissionError.message}`;
    }

    setError(errorMsg);
    setIsConnecting(false);
  }, []);

  // Function to check and request permissions manually
  const requestPermissions = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Media devices API not available in this browser.');
      return false;
    }

    try {
      setNeedsPermission(false);
      setError(null);
      setIsConnecting(true);

      const constraints: MediaStreamConstraints = {
        video: enableVideo ? { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: enableAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
      };

      console.log('useDaily: Manually requesting permissions with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('useDaily: Permissions granted via manual request');
      
      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());
      
      // Retry initialization if we have a call object and room URL
      if (callObjectRef.current && roomUrl) {
        try {
          console.log('useDaily: Retrying join after permission grant');
          await callObjectRef.current.join({
            url: roomUrl,
            token: token || undefined,
            userName: 'User',
          });
          
          await callObjectRef.current.setLocalAudio(enableAudio);
          await callObjectRef.current.setLocalVideo(enableVideo);
          
          console.log('useDaily: Successfully joined after permission grant');
        } catch (joinError: any) {
          console.error('useDaily: Error joining after permission grant:', joinError);
          setError('Failed to join call after permissions were granted. Please refresh the page and try again.');
          setIsConnecting(false);
        }
      } else {
        // If we don't have a call object yet, the useEffect will handle joining
        console.log('useDaily: Call object not ready, will join when available');
      }
      
      return true;
    } catch (permissionError: any) {
      console.error('useDaily: Manual permission request failed:', permissionError);
      handlePermissionError(permissionError, enableVideo, enableAudio);
      return false;
    }
  }, [enableVideo, enableAudio, roomUrl, token, handlePermissionError]);


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Don't initialize if required params are missing
    if (!roomUrl || roomUrl.trim() === '') {
      console.log('useDaily: Skipping initialization - no roomUrl');
      return;
    }

    let isUnmounted = false;

    const initialize = async () => {
      try {
        console.log('useDaily: Starting initialization', { roomUrl, enableVideo, enableAudio });
        
        // Check if mediaDevices API is available FIRST
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const errorMsg = 'Media devices API not available in this browser. Please use a modern browser like Chrome, Firefox, or Safari.';
          console.error('useDaily:', errorMsg);
          if (!isUnmounted) {
            setError(errorMsg);
            setIsConnecting(false);
          }
          return;
        }

        // Request permissions BEFORE creating Daily.co call object
        // This ensures the browser prompts for permissions immediately
        if (enableVideo || enableAudio) {
          console.log('useDaily: Requesting media permissions...', { video: enableVideo, audio: enableAudio });
          
          try {
            const constraints: MediaStreamConstraints = {
              video: enableVideo ? { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
              } : false,
              audio: enableAudio ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              } : false,
            };
            
            console.log('useDaily: Calling getUserMedia with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('useDaily: Media permissions granted, got stream:', stream);
            console.log('useDaily: Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
            
            // Stop the test stream immediately - we'll get new tracks from Daily.co after joining
            // This is just to trigger the permission prompt
            stream.getTracks().forEach((track) => {
              console.log('useDaily: Stopping test track:', track.kind);
              track.stop();
            });
            
            console.log('useDaily: Test stream stopped, proceeding to join Daily.co room');
          } catch (permissionError: any) {
            console.error('useDaily: Media permission error:', permissionError);
            console.error('useDaily: Error details:', {
              name: permissionError.name,
              message: permissionError.message,
              constraint: permissionError.constraint,
            });
            
            if (!isUnmounted) {
              handlePermissionError(permissionError, enableVideo, enableAudio);
            }
            return; // Don't proceed if permissions are denied
          }
        } else {
          console.log('useDaily: Skipping permission request - video and audio are disabled');
        }

        // Dynamically import Daily.co SDK
        // TypeScript types are declared in types/daily-js.d.ts
        console.log('useDaily: Importing Daily.co SDK...');
        const dailyModule = await import('@daily-co/daily-js');
        const DailyIframe = dailyModule.default || (dailyModule as any).DailyIframe || dailyModule;

        if (isUnmounted) {
          console.log('useDaily: Component unmounted, aborting');
          return;
        }

        console.log('useDaily: Creating Daily.co call object...');
        setIsConnecting(true);
        setError(null);

        // Create call object (not iframe) for custom UI
        const callObject = DailyIframe.createCallObject();
        console.log('useDaily: Call object created');

        callObjectRef.current = callObject;

        // Helper function to update participants from call object state
        const updateParticipantsFromState = () => {
          if (isUnmounted || !callObject) return;
          
          try {
            const participantsState = callObject.participants();
            if (!participantsState) return;
            
            const updatedParticipants = new Map<string, DailyParticipant>();
            
            // Get local participant (Daily.co uses 'local' key)
            const localParticipant = participantsState.local;
            if (localParticipant) {
              // Daily.co provides tracks through participant objects
              // Tracks might be accessed via participant.videoTrack or through track events
              // For now, we'll rely on track-started events to update tracks
            }
            
            // Get remote participants (all keys except 'local')
            Object.keys(participantsState).forEach((sessionId) => {
              if (sessionId === 'local') return; // Skip local participant
              
              const participant = participantsState[sessionId];
              if (participant) {
                updatedParticipants.set(sessionId, {
                  session_id: sessionId,
                  user_name: participant.user_name,
                  videoTrack: participant.videoTrack || null,
                  audioTrack: participant.audioTrack || null,
                  local: false,
                });
              }
            });
            
            setParticipants(updatedParticipants);
          } catch (err) {
            console.error('Error updating participants from state', err);
          }
        };

        // Set up event handlers
        callObject
          .on('joined-meeting', (event: any) => {
            if (isUnmounted) return;
            console.log('Joined Daily.co meeting', event);
            setIsConnected(true);
            setIsConnecting(false);
            
            // Get local tracks after joining
            try {
              const participantsState = callObject.participants();
              const localParticipant = participantsState?.local;
              if (localParticipant) {
                // Daily.co provides tracks through the participant object
                // We'll get them from track-started events, but also check participant state
                if (localParticipant.videoTrack) {
                  setLocalVideoTrack(localParticipant.videoTrack);
                }
                if (localParticipant.audioTrack) {
                  setLocalAudioTrack(localParticipant.audioTrack);
                }
              }
            } catch (err) {
              console.error('Error getting local tracks', err);
            }
            
            updateParticipantsFromState();
          })
          .on('left-meeting', () => {
            if (isUnmounted) return;
            console.log('Left Daily.co meeting');
            setIsConnected(false);
            setParticipants(new Map());
            setLocalVideoTrack(null);
            setLocalAudioTrack(null);
          })
          .on('participant-joined', (event: any) => {
            if (isUnmounted) return;
            console.log('Participant joined', event);
            updateParticipantsFromState();
          })
          .on('participant-left', (event: any) => {
            if (isUnmounted) return;
            console.log('Participant left', event);
            setParticipants((prev) => {
              const updated = new Map(prev);
              updated.delete(event.participant?.session_id);
              return updated;
            });
          })
          .on('participant-updated', (event: any) => {
            if (isUnmounted) return;
            console.log('Participant updated', event);
            updateParticipantsFromState();
          })
          .on('track-started', (event: any) => {
            if (isUnmounted) return;
            console.log('Track started', event);
            
            // Update tracks from event
            const { participant, track } = event;
            if (!participant || !track) {
              console.warn('Track started event missing participant or track', event);
              updateParticipantsFromState();
              return;
            }
            
            console.log('Track started details:', {
              isLocal: participant.local,
              trackKind: track.kind,
              sessionId: participant.session_id,
              trackId: track.id,
              trackEnabled: track.enabled,
              trackReadyState: track.readyState,
            });
            
            if (participant.local) {
              // Local tracks
              if (track.kind === 'video') {
                console.log('Setting local video track');
                setLocalVideoTrack(track);
              } else if (track.kind === 'audio') {
                console.log('Setting local audio track');
                setLocalAudioTrack(track);
              }
            } else {
              // Remote tracks - ensure we update participants state
              console.log('Setting remote track for participant:', participant.session_id);
              setParticipants((prev) => {
                const updated = new Map(prev);
                const existing: DailyParticipant = updated.get(participant.session_id) || {
                  session_id: participant.session_id,
                  user_name: participant.user_name,
                  local: false,
                  videoTrack: null,
                  audioTrack: null,
                };
                
                if (track.kind === 'video') {
                  existing.videoTrack = track;
                  console.log('Remote video track set for', participant.session_id);
                } else if (track.kind === 'audio') {
                  existing.audioTrack = track;
                  console.log('Remote audio track set for', participant.session_id);
                }
                
                updated.set(participant.session_id, existing);
                return updated;
              });
            }
          })
          .on('track-stopped', (event: any) => {
            if (isUnmounted) return;
            console.log('Track stopped', event);
            
            // Update tracks from event
            const { participant, track } = event;
            if (!participant || !track) {
              updateParticipantsFromState();
              return;
            }
            
            if (participant.local) {
              // Local tracks
              if (track.kind === 'video') {
                setLocalVideoTrack(null);
              } else if (track.kind === 'audio') {
                setLocalAudioTrack(null);
              }
            } else {
              // Remote tracks
              setParticipants((prev) => {
                const updated = new Map(prev);
                const existing: DailyParticipant | undefined = updated.get(participant.session_id);
                if (existing) {
                  if (track.kind === 'video') {
                    existing.videoTrack = null;
                  } else if (track.kind === 'audio') {
                    existing.audioTrack = null;
                  }
                  updated.set(participant.session_id, existing);
                }
                return updated;
              });
            }
          })
          .on('error', (error: any) => {
            if (isUnmounted) return;
            console.error('Daily.co error', error);
            
            // Handle specific error types
            let errorMessage = 'Failed to connect to the meeting. Please try again.';
            
            if (error.errorMsg) {
              errorMessage = error.errorMsg;
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            // Check for permission-related errors
            if (errorMessage.toLowerCase().includes('permission') || 
                errorMessage.toLowerCase().includes('notallowed') ||
                errorMessage.toLowerCase().includes('denied')) {
              errorMessage = enableVideo
                ? 'Camera and microphone permissions are required. Please allow access and try again.'
                : 'Microphone permission is required. Please allow access and try again.';
            }
            
            // Check for device not found errors
            if (errorMessage.toLowerCase().includes('notfound') ||
                errorMessage.toLowerCase().includes('no device')) {
              errorMessage = enableVideo
                ? 'No camera or microphone found. Please connect a device and try again.'
                : 'No microphone found. Please connect a microphone and try again.';
            }
            
            setError(errorMessage);
            setIsConnecting(false);
            setIsConnected(false);
          })
          .on('loading-started', () => {
            if (isUnmounted) return;
            console.log('Daily.co loading started');
            setIsConnecting(true);
          })
          .on('loading-stopped', () => {
            if (isUnmounted) return;
            console.log('Daily.co loading stopped');
          });

        // Join the room
        const joinConfig: any = {
          url: roomUrl,
          userName: 'User',
        };

        if (token) {
          joinConfig.token = token;
        }

        console.log('useDaily: Joining Daily.co room...', { url: roomUrl, hasToken: !!token });
        
        // Join the room
        await callObject.join(joinConfig);

        console.log('useDaily: Successfully joined Daily.co room');

        // Set media settings after joining
        // These settings control whether the user's camera/mic are enabled
        // We've already requested permissions, so this should work
        // IMPORTANT: For calls, both participants need to publish their tracks
        if (enableAudio !== undefined) {
          console.log('useDaily: Setting local audio to:', enableAudio);
          try {
            await callObject.setLocalAudio(enableAudio);
            console.log('useDaily: Local audio set successfully');
            // Verify audio is actually enabled
            const audioEnabled = await callObject.localAudio();
            console.log('useDaily: Local audio enabled state:', audioEnabled);
          } catch (audioError) {
            console.error('useDaily: Failed to set local audio', audioError);
          }
        }
        
        if (enableVideo !== undefined) {
          console.log('useDaily: Setting local video to:', enableVideo);
          try {
            await callObject.setLocalVideo(enableVideo);
            console.log('useDaily: Local video set successfully');
            // Verify video is actually enabled
            const videoEnabled = await callObject.localVideo();
            console.log('useDaily: Local video enabled state:', videoEnabled);
          } catch (videoError) {
            console.error('useDaily: Failed to set local video', videoError);
          }
        }
        
        // Force update participants state after setting media
        // This ensures we capture any tracks that were already available
        setTimeout(() => {
          updateParticipantsFromState();
        }, 500);
        
        console.log('useDaily: Initialization complete');
      } catch (error: any) {
        console.error('Failed to initialize Daily.co', error);
        if (!isUnmounted) {
          setError(error.message || 'Failed to connect to the meeting. Please try again.');
          setIsConnecting(false);
        }
      }
    };

    initialize();

    return () => {
      isUnmounted = true;

      if (callObjectRef.current) {
        try {
          callObjectRef.current.leave().catch((err: unknown) => {
            console.error('Failed to leave Daily.co call:', err);
          });
          callObjectRef.current.destroy().catch((err: unknown) => {
            console.error('Failed to destroy Daily.co call object:', err);
          });
        } catch (err) {
          console.error('Error cleaning up Daily.co call object:', err);
        }
        callObjectRef.current = null;
      }

      setIsConnected(false);
      setParticipants(new Map());
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
    };
  }, [roomUrl, token, enableVideo, enableAudio]);

  // Methods to control video/audio
  const toggleVideo = async () => {
    if (callObjectRef.current) {
      try {
        const isVideoEnabled = await callObjectRef.current.localVideo();
        await callObjectRef.current.setLocalVideo(!isVideoEnabled);
      } catch (error) {
        console.error('Failed to toggle video', error);
      }
    }
  };

  const toggleAudio = async () => {
    if (callObjectRef.current) {
      try {
        const isAudioEnabled = await callObjectRef.current.localAudio();
        await callObjectRef.current.setLocalAudio(!isAudioEnabled);
      } catch (error) {
        console.error('Failed to toggle audio', error);
      }
    }
  };

  // Get remote participants (excluding local)
  const remoteParticipants = Array.from(participants.values()).filter((p) => !p.local);

  return {
    isConnected,
    isConnecting,
    error,
    needsPermission,
    participants: remoteParticipants,
    localVideoTrack,
    localAudioTrack,
    callObject: callObjectRef.current,
    toggleVideo,
    toggleAudio,
    requestPermissions,
  };
}
