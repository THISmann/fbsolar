import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Reveal } from '../components/Reveal';
import { api, sanitizeText } from '../lib/api';
import './Page.scss';

type FormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

const initial: FormState = { name: '', email: '', phone: '', message: '' };

export function ContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      await api.contact({
        name: sanitizeText(form.name, 100),
        email: sanitizeText(form.email, 200),
        phone: form.phone.trim() ? sanitizeText(form.phone, 30) : undefined,
        message: sanitizeText(form.message, 5000),
      });
      setStatus('ok');
      setForm(initial);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : t('contact.error'));
    }
  }

  return (
    <div className="page">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">{t('contact.eyebrow')}</p>
          <h1>{t('contact.title')}</h1>
          <p>{t('contact.lead')}</p>
        </div>
      </header>

      <section className="page-section">
        <div className="container contact-layout">
          <Reveal>
            <div className="contact-aside">
              <p>
                <strong>{t('common.brandFull')}</strong>
                <br />
                12 avenue du Soleil
                <br />
                69003 Lyon
              </p>
              <p>
                <a href="tel:+33123456789">01 23 45 67 89</a>
                <br />
                <a href="mailto:contact@fbsolar.local">contact@fbsolar.local</a>
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <form className="contact-form" onSubmit={onSubmit} noValidate>
              <label>
                {t('contact.name')}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label>
                {t('contact.email')}
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label>
                {t('contact.phone')}
                <input
                  name="phone"
                  maxLength={30}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label>
                {t('contact.message')}
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </label>

              {status === 'ok' && <p className="status status--ok">{t('contact.success')}</p>}
              {status === 'error' && <p className="status status--error">{error}</p>}

              <button className="btn btn--solid" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? t('contact.sending') : t('contact.submit')}
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
