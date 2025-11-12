import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getUser } from '../lib/auth';

interface NotificationsBellProps {
  onClick: () => void;
}

export default function NotificationsBell({ onClick }: NotificationsBellProps) {
  const [socket, setSocket] = useState<any>(null);
  const currentUser = getUser();

  const { data, refetch } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsAPI.getNotifications({ unread_only: true, limit: 1 }),
    refetchInterval: false, // Disable automatic refetch - rely on Socket.io for real-time updates
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });

  const unreadCount = data?.unreadCount || 0;

  // Set up Socket.io for real-time notifications
  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') return;

    const socketInstance = getSocket();
    setSocket(socketInstance);

    // Join user room for real-time notifications
    socketInstance.emit('join:user', currentUser.id);

    // Listen for new notifications - refetch immediately when notification arrives
    const handleNotification = () => {
      // Immediately refetch unread count when new notification arrives
      refetch();
    };

    socketInstance.on('notification.new', handleNotification);

    return () => {
      socketInstance.off('notification.new', handleNotification);
    };
  }, [currentUser?.id, refetch]);

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 hover:text-gray-900"
    >
      <span className="text-2xl">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
