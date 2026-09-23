import { registerSW } from 'virtual:pwa-register';
import { warmPublicCache } from './publicApiCache';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || 'http://localhost';

/**
 * Registers the service worker (production / preview) and warms public API cache
 * so the vitrine remains usable after connectivity drops.
 */
export function registerPwa(): void {
  if (typeof window === 'undefined') return;

  const warm = () => {
    void warmPublicCache(API_BASE);
  };

  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Periodic update check while the tab stays open
          window.setInterval(() => {
            void registration.update();
          }, 60 * 60 * 1000);
        }
        warm();
      },
      onOfflineReady() {
        warm();
      },
    });
  } else {
    // Dev: no SW by default — still warm Cache API for offline API fallback testing
    warm();
  }

  window.addEventListener('online', warm);
}
