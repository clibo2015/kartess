import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const token = getToken();
    
    socket = io(SOCKET_SERVER_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // If disconnected due to server error, try to reconnect
      if (reason === 'io server disconnect') {
        socket?.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Auto-reconnect on connection loss
    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
