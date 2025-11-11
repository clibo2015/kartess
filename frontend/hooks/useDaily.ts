import { useEffect, useRef, useState } from 'react';

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
  const [participants, setParticipants] = useState<Map<string, DailyParticipant>>(new Map());
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const callObjectRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Don't initialize if required params are missing
    if (!roomUrl) {
      return;
    }

    let isUnmounted = false;

    const initialize = async () => {
      try {
        // Dynamically import Daily.co SDK
        const DailyIframe = (await import('@daily-co/daily-js')).default;

        if (isUnmounted) {
          return;
        }

        setIsConnecting(true);
        setError(null);

        // Create call object (not iframe) for custom UI
        const callObject = DailyIframe.createCallObject();

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
              updateParticipantsFromState();
              return;
            }
            
            if (participant.local) {
              // Local tracks
              if (track.kind === 'video') {
                setLocalVideoTrack(track);
              } else if (track.kind === 'audio') {
                setLocalAudioTrack(track);
              }
            } else {
              // Remote tracks
              setParticipants((prev) => {
                const updated = new Map(prev);
                const existing = updated.get(participant.session_id) || {
                  session_id: participant.session_id,
                  user_name: participant.user_name,
                  local: false,
                };
                
                if (track.kind === 'video') {
                  existing.videoTrack = track;
                } else if (track.kind === 'audio') {
                  existing.audioTrack = track;
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
                const existing = updated.get(participant.session_id);
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

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices API not available in this browser');
        }

        // Join the room
        const joinConfig: any = {
          url: roomUrl,
          userName: 'User',
        };

        if (token) {
          joinConfig.token = token;
        }

        // Join the room
        // Daily.co will handle permission requests automatically
        await callObject.join(joinConfig);

        // Set media settings after joining
        // These settings control whether the user's camera/mic are enabled
        // Daily.co will request permissions when these are enabled
        await callObject.setLocalAudio(enableAudio);
        await callObject.setLocalVideo(enableVideo);
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
    participants: remoteParticipants,
    localVideoTrack,
    localAudioTrack,
    callObject: callObjectRef.current,
    toggleVideo,
    toggleAudio,
  };
}
