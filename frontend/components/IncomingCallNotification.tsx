import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from './Button';
import Image from 'next/image';
import { liveAPI } from '../lib/api';

interface IncomingCallNotificationProps {
  call: {
    sessionId: string;
    threadId: string;
    caller: {
      id: string;
      username: string;
      full_name?: string;
      profile?: {
        avatar_url?: string;
      };
    };
    type: string; // 'voice' or 'video'
    roomUrl: string;
  };
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallNotification({ call, onAccept, onReject }: IncomingCallNotificationProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [ringing, setRinging] = useState(true);

  // Play ringing sound (optional - you can add an audio file)
  useEffect(() => {
    // You can add a ringing sound here if desired
    // const audio = new Audio('/sounds/ringtone.mp3');
    // audio.loop = true;
    // audio.play();
    // return () => audio.pause();
  }, []);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      // Accept the call - this will return room URL and token
      await liveAPI.acceptCall(call.sessionId);
      onAccept();
      // Navigate to call page with sessionId - the page will auto-connect
      router.push(`/chats/${call.threadId}/call?sessionId=${call.sessionId}&type=${call.type}`);
    } catch (error) {
      console.error('Failed to accept call', error);
      setIsProcessing(false);
      alert('Failed to accept call. Please try again.');
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await liveAPI.rejectCall(call.sessionId);
      onReject();
    } catch (error) {
      console.error('Failed to reject call', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-pulse">
        <div className="text-center">
          {/* Caller Avatar */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200">
              {call.caller.profile?.avatar_url ? (
                <Image
                  src={call.caller.profile.avatar_url}
                  alt={call.caller.full_name || call.caller.username}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-600">
                  {call.caller.full_name?.charAt(0) || call.caller.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Caller Name */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {call.caller.full_name || call.caller.username}
          </h2>

          {/* Call Type */}
          <p className="text-gray-600 mb-8">
            {call.type === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
          </p>
          
          {/* Ringing Animation */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500 rounded-full animate-ping absolute"></div>
              <div className="w-16 h-16 border-4 border-blue-500 rounded-full"></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="primary"
              onClick={handleAccept}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg rounded-full"
            >
              {isProcessing ? 'Answering...' : '✅ Answer'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleReject}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg rounded-full"
            >
              {isProcessing ? 'Rejecting...' : '❌ Decline'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
