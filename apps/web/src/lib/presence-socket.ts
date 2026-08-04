'use client';

import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api';
import { getAccessToken } from './auth';

export interface PresenceEntry {
  userId: string;
  realm: 'platform' | 'tenant';
  fullName: string;
  role?: string;
  roles?: string[];
  tenantSlug?: string;
  schoolName?: string;
  connectedAt: string;
}

export interface PresenceSnapshot {
  onlineNow: number;
  offlineNow: number;
  totalUsers: number;
  online: PresenceEntry[];
}

// Module-level singleton — one "I'm online" socket per browser tab for the whole app session (see
// usePresenceOnline below), not one per page. A Super Admin/Assistant Super Admin viewing the
// presence dashboard doesn't open a second connection to watch for updates — they attach a listener
// to this same socket via onPresenceSnapshot(), since their own connection is already in the
// server's 'admins' broadcast room (see PresenceGateway).
let activeSocket: Socket | null = null;
const pendingListeners = new Set<(snapshot: PresenceSnapshot) => void>();

/** Mount once per authenticated session — at the layout level (apps/web/src/app/dashboard/layout.tsx
 * and apps/web/src/app/school/layout.tsx), not per-page, so the connection persists across in-app
 * navigation and only ends on tab-close/logout. Connect = online, disconnect = offline, reflected
 * server-side within a Socket.IO ping-timeout of it actually happening. */
export function usePresenceOnline() {
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(`${API_ORIGIN}/presence`, { auth: { token }, transports: ['websocket', 'polling'] });
    activeSocket = socket;
    pendingListeners.forEach((cb) => socket.on('presence:snapshot', cb));

    return () => {
      pendingListeners.forEach((cb) => socket.off('presence:snapshot', cb));
      socket.disconnect();
      if (activeSocket === socket) activeSocket = null;
    };
  }, []);
}

/** Subscribes to live presence updates on the already-open singleton socket. Queues the listener if
 * the socket isn't open yet (handles the page-mounts-before-layout-effect-runs ordering case) and
 * attaches it as soon as usePresenceOnline() creates the connection. Returns an unsubscribe function. */
export function onPresenceSnapshot(callback: (snapshot: PresenceSnapshot) => void): () => void {
  pendingListeners.add(callback);
  activeSocket?.on('presence:snapshot', callback);
  return () => {
    pendingListeners.delete(callback);
    activeSocket?.off('presence:snapshot', callback);
  };
}
