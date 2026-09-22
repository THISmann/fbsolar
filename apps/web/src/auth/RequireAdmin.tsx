import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Permission } from '../lib/permissions';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, isAdmin } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="admin-boot">
        <p>Vérification de la session…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { ready, can, isAdmin } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="admin-boot">
        <p>Vérification de la session…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!can(permission)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
