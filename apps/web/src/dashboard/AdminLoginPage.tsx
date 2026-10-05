import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { sanitizeText } from '../lib/api';
import { useSeo } from '../lib/seo';
import './dashboard.scss';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const { login, isAdmin, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useSeo({ title: t('seo.adminTitle'), noindex: true });

  if (ready && isAdmin) {
    const from = (location.state as { from?: string } | null)?.from || '/admin';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(sanitizeText(email, 200), password);
      const from = (location.state as { from?: string } | null)?.from || '/admin';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <img
          className="admin-login__logo"
          src="/brand/fb-solar-logo.png"
          alt={t('common.brandFull')}
          width={220}
          height={72}
        />
        <p className="eyebrow">{t('admin.loginEyebrow')}</p>
        <h1>{t('admin.loginTitle')}</h1>
        <p>{t('admin.loginLead')}</p>
        <form onSubmit={onSubmit} autoComplete="on">
          <label>
            {t('admin.email')}
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t('admin.password')}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="status status--error">{error}</p>}
          <button className="btn btn--solid" type="submit" disabled={loading}>
            {loading ? t('admin.signingIn') : t('admin.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
