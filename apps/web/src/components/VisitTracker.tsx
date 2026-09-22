import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const VISITOR_KEY = 'solar.visitor';

function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length <= 64) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return 'anonymous';
  }
}

/** Fire-and-forget pageview — never blocks navigation (OWASP: no PII beyond anonymous id). */
export function VisitTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    const path = `${location.pathname}${location.search}`.slice(0, 500);
    void api.trackVisit({
      path,
      referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 1000) : undefined,
      visitorId: visitorId(),
    });
  }, [location.pathname, location.search]);

  return null;
}
