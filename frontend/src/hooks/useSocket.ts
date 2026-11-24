import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const SOCKET_BASE_URL = RAW_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_BASE_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket>(() => getSocket());
  const [isConnected, setIsConnected] = useState<boolean>(() => socket.connected);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('reconnect', onConnect);

    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('reconnect', onConnect);
    };
  }, []);

  return {
    socket,
    isConnected,
  };
}
