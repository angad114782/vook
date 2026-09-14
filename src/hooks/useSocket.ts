import { useContext } from 'react';
import type { Socket } from 'socket.io-client';
import { SocketContext } from '../context/socketContextValue';

/** Returns the shared socket instance, or null before authentication. */
export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
