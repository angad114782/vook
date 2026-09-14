import { useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { runtimeConfig, isMockMode } from '../config/runtime';
import { useAuthStore } from '../store/authStore';
import { createMockSocket } from '../realtime/mockSocket';
import { SocketContext } from './socketContextValue';

export function SocketProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }
    const next = isMockMode
      ? createMockSocket()
      : io(runtimeConfig.realtimeUrl, { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 30_000 });
    next.on('connect', () => window.dispatchEvent(new CustomEvent('socket:reconnect')));
    next.on('connect_error', (error) => console.warn('[realtime] connection error:', error.message));
    socketRef.current = next;
    setSocket(next);
    if (isMockMode) window.dispatchEvent(new CustomEvent('socket:reconnect'));
    return () => {
      next.disconnect();
      if (socketRef.current === next) socketRef.current = null;
      setSocket((current) => current === next ? null : current);
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
