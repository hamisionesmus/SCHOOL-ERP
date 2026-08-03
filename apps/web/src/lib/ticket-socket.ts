'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api';
import { getAccessToken } from './auth';

export interface LiveComment {
  id: string;
  body: string;
  createdAt: string;
  isPlatformReply: boolean;
  platformAuthorName: string | null;
  author: { id: string; fullName: string } | null;
}

/** Plays a short two-tone beep via the Web Audio API — no binary asset to source/commit. Only
 * fires for messages the current user didn't author (see onComment callers). */
function playDeliverySound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.13);
    });
    setTimeout(() => ctx.close(), 400);
  } catch {
    // Best-effort only — a browser blocking audio without user interaction is not an error.
  }
}

/** Joins the `ticket:{ticketId}` room shared by both the tenant-side and platform-side chat UI (see
 * apps/api/src/tickets/tickets.gateway.ts). REST stays the source of truth for sending/persisting;
 * this only receives the live broadcast plus ephemeral typing pings. */
export function useTicketSocket(
  ticketId: string | undefined,
  onComment: (comment: LiveComment) => void,
  onStatusChange: (status: string) => void,
) {
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(`${API_ORIGIN}/tickets`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join', { ticketId }));
    socket.on('comment:new', (comment: LiveComment) => {
      onComment(comment);
      playDeliverySound();
    });
    socket.on('ticket:status', ({ status }: { status: string }) => onStatusChange(status));
    socket.on('typing', ({ fullName }: { fullName: string }) => {
      setTypingUser(fullName);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUser(null), 3000);
    });

    return () => {
      socket.emit('leave', { ticketId });
      socket.disconnect();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  function emitTyping() {
    if (ticketId) socketRef.current?.emit('typing', { ticketId });
  }

  return { typingUser, emitTyping };
}
