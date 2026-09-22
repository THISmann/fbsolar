import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Send staff to the first section they are allowed to see. */
export function AdminHomeRedirect() {
  const { can, isSuperAdmin } = useAuth();

  if (can('visits.read')) return <Navigate to="/admin/visites" replace />;
  if (can('projects.write')) return <Navigate to="/admin/projets" replace />;
  if (can('pages.write')) return <Navigate to="/admin/accueil" replace />;
  if (can('products.write')) return <Navigate to="/admin/produits" replace />;
  if (can('contacts.read')) return <Navigate to="/admin/contacts" replace />;
  if (isSuperAdmin) return <Navigate to="/admin/utilisateurs" replace />;
  return <Navigate to="/admin/login" replace />;
}
