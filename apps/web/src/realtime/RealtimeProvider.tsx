import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { peekAccessToken } from '../lib/api';
import { randomId } from '../lib/uuid';

export type ContentResource = 'product' | 'project' | 'page' | 'category' | 'article' | 'contact' | 'media';

export type ContentChangedEvent = {
  resource: ContentResource;
  action: 'created' | 'updated' | 'deleted';
  id?: string;
  slug?: string;
  key?: string;
  kind?: 'PRODUCT' | 'PROJECT';
  at: string;
};

type RealtimeState = {
  connected: boolean;
  revision: number;
  lastEvent: ContentChangedEvent | null;
};

const VISITOR_KEY = 'solar.visitor';
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || 'http://localhost';

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  revision: 0,
  lastEvent: null,
});

function ensureVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length <= 64) return existing;
    const id = randomId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  const [lastEvent, setLastEvent] = useState<ContentChangedEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = peekAccessToken();
    authTokenRef.current = token;
    const auth = token ? { token } : { visitorId: ensureVisitorId() };

    const socket = io(API_BASE, {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth,
      reconnection: true,
      reconnectionDelay: 1200,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('content:changed', (event: ContentChangedEvent) => {
      setLastEvent(event);
      setRevision((n) => n + 1);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Re-auth only when the admin access token actually changes
  useEffect(() => {
    const id = window.setInterval(() => {
      const socket = socketRef.current;
      if (!socket) return;
      const token = peekAccessToken();
      if (token === authTokenRef.current) return;
      authTokenRef.current = token;
      socket.auth = token ? { token } : { visitorId: ensureVisitorId() };
      if (socket.connected) socket.disconnect().connect();
    }, 8000);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo(
    () => ({ connected, revision, lastEvent }),
    [connected, revision, lastEvent],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}

/**
 * Re-runs `reload` when a matching content:changed event arrives.
 * Only reacts to new Socket.IO revisions (never to unstable callback/array identities).
 */
export function useRealtimeRefresh(
  resources: ContentResource[] | 'all',
  reload: () => void | Promise<void>,
  opts?: { keys?: string[]; slugs?: string[] },
): void {
  const { revision, lastEvent } = useRealtime();
  const reloadRef = useRef(reload);
  const resourcesRef = useRef(resources);
  const optsRef = useRef(opts);
  const lastHandledRevision = useRef(0);
  const timer = useRef<number | null>(null);

  reloadRef.current = reload;
  resourcesRef.current = resources;
  optsRef.current = opts;

  useEffect(() => {
    if (!lastEvent || revision === 0) return;
    if (revision === lastHandledRevision.current) return;

    const wanted = resourcesRef.current;
    if (wanted !== 'all' && !wanted.includes(lastEvent.resource)) return;

    const filter = optsRef.current;
    if (filter?.keys?.length && lastEvent.key && !filter.keys.includes(lastEvent.key)) return;
    if (filter?.slugs?.length && lastEvent.slug && !filter.slugs.includes(lastEvent.slug)) return;

    lastHandledRevision.current = revision;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void reloadRef.current();
    }, 300);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [revision, lastEvent]);
}
