import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  api,
  sanitizeText,
  type StaffUser,
} from '../lib/api';
import {
  ASSIGNABLE_ROLES,
  type StaffRole,
} from '../lib/permissions';
import { IconButton } from './AdminIcons';

const emptyForm = {
  email: '',
  password: '',
  role: 'CONTENT_EDITOR' as StaffRole,
  jobTitle: '',
};

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function roleLabel(role: StaffRole) {
    return t(`admin.roles.${role}`);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.listStaff());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api.createStaff({
        email: sanitizeText(form.email, 200).toLowerCase(),
        password: form.password,
        role: form.role,
        jobTitle: sanitizeText(form.jobTitle, 120) || undefined,
      });
      setForm(emptyForm);
      setOk(t('admin.users.created'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.createError'));
    }
  }

  async function changeRole(id: string, role: StaffRole) {
    try {
      await api.updateStaff(id, { role });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.updateError'));
    }
  }

  async function toggleActive(user: StaffUser) {
    try {
      if (user.active) await api.disableStaff(user.id);
      else await api.updateStaff(user.id, { active: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.updateError'));
    }
  }

  return (
    <div>
      <h1>{t('admin.users.title')}</h1>
      <p className="lead">{t('admin.users.lead')}</p>

      <form className="admin-form" onSubmit={onCreate}>
        <div className="admin-panel">
          <h2>{t('admin.users.createTitle')}</h2>
          <div className="admin-form__row">
            <label>
              {t('admin.users.email')}
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label>
              {t('admin.users.passwordMin')}
              <input
                type="password"
                required
                minLength={12}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-form__row">
            <label>
              {t('admin.users.role')}
              <select
                className="admin-select"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('admin.users.jobTitle')}
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder={t('admin.users.jobPlaceholder')}
                maxLength={120}
              />
            </label>
          </div>
          <p className="lead">{t('admin.users.hint')}</p>
          <button className="btn btn--solid" type="submit">
            {t('admin.users.create')}
          </button>
        </div>
      </form>

      {error && <p className="status status--error">{error}</p>}
      {ok && <p className="status status--ok">{ok}</p>}
      {loading && <p className="status">{t('common.loading')}</p>}

      {!loading && (
        <div className="admin-panel">
          <h2>{t('admin.users.team')}</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.users.email')}</th>
                <th>{t('admin.users.position')}</th>
                <th>{t('admin.users.roleCol')}</th>
                <th>{t('common.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.jobTitle || '—'}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={user.role === 'ADMIN' ? 'SUPER_ADMIN' : user.role}
                      onChange={(e) => void changeRole(user.id, e.target.value as StaffRole)}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`admin-badge ${user.active ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                      {user.active ? t('common.active') : t('common.disabled')}
                    </span>
                  </td>
                  <td className="actions">
                    <IconButton
                      icon={user.active ? 'userOff' : 'userCheck'}
                      label={user.active ? t('admin.users.deactivate') : t('admin.users.reactivate')}
                      tone={user.active ? 'danger' : 'ok'}
                      onClick={() => void toggleActive(user)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
