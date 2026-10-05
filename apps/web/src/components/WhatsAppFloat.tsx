import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './WhatsAppFloat.scss';

const DEFAULT_PHONE = '+33 6 12 34 56 78';
const DEFAULT_MESSAGE = 'Bonjour, je souhaite des informations sur une installation solaire.';

type Props = {
  phone?: string;
  message?: string;
  enabled?: boolean;
};

/** Normalize to digits for https://wa.me/<number> (international, no +). */
export function toWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function WhatsAppFloat({ phone, message, enabled = true }: Props) {
  if (!enabled || !phone) return null;
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  const text = message?.trim()
    ? `?text=${encodeURIComponent(message.trim().slice(0, 500))}`
    : '';
  const href = `https://wa.me/${number}${text}`;

  return (
    <a
      className="whatsapp-float"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter via WhatsApp"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16.04 3C9.4 3 4 8.34 4 14.9c0 2.1.55 4.12 1.6 5.92L4 29l8.4-2.2a12.1 12.1 0 0 0 3.64.55c6.64 0 12.04-5.34 12.04-11.9C28.08 8.34 22.68 3 16.04 3zm0 21.7c-1.2 0-2.38-.3-3.42-.88l-.24-.14-4.98 1.3 1.33-4.85-.16-.25a9.5 9.5 0 0 1-1.46-5.06c0-5.26 4.34-9.54 9.93-9.54s9.93 4.28 9.93 9.54-4.34 9.54-9.93 9.54zm5.45-7.14c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.1 4.48.71.3 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"
        />
      </svg>
      <span className="whatsapp-float__label">WhatsApp</span>
    </a>
  );
}

/** Site-wide button: settings live in the `home` CMS page (admin › WhatsApp). */
export function SiteWhatsApp() {
  const [settings, setSettings] = useState<Required<Props>>({
    enabled: true,
    phone: DEFAULT_PHONE,
    message: DEFAULT_MESSAGE,
  });

  const load = useCallback(
    () =>
      api
        .page('home')
        .then((page) => {
          const data = page.data as { whatsappEnabled?: boolean; whatsappPhone?: string; whatsappMessage?: string };
          setSettings({
            enabled: data.whatsappEnabled !== false,
            phone: data.whatsappPhone || DEFAULT_PHONE,
            message: data.whatsappMessage ?? DEFAULT_MESSAGE,
          });
        })
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh(['page'], load, { keys: ['home'] });

  return <WhatsAppFloat {...settings} />;
}
