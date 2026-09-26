import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin, RequirePermission } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import { VisitTracker } from './components/VisitTracker';
import { AdminHomeRedirect } from './dashboard/AdminHomeRedirect';
import { AdminLoginPage } from './dashboard/AdminLoginPage';
import { AuditPage } from './dashboard/AuditPage';
import { CatalogEditPage, CatalogListPage } from './dashboard/CatalogAdmin';
import { ContactsPage } from './dashboard/ContactsPage';
import { DashboardLayout } from './dashboard/DashboardLayout';
import { PageEditor } from './dashboard/PageEditor';
import { SocialPublicationsPage } from './dashboard/SocialPublicationsPage';
import { UsersPage } from './dashboard/UsersPage';
import { VisitsPage } from './dashboard/VisitsPage';
import { WhatsAppSettingsPage } from './dashboard/WhatsAppSettingsPage';
import { AboutPage } from './pages/About';
import { ContactPage } from './pages/Contact';
import { ExpertisesPage } from './pages/Expertises';
import { HomePage } from './pages/Home';
import { ProductDetailPage } from './pages/ProductDetail';
import { ProductsPage } from './pages/Products';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { RealtimeProvider } from './realtime/RealtimeProvider';

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <VisitTracker />
          <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <DashboardLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminHomeRedirect />} />
            <Route
              path="visites"
              element={
                <RequirePermission permission="visits.read">
                  <VisitsPage />
                </RequirePermission>
              }
            />
            <Route
              path="produits"
              element={
                <RequirePermission permission="products.write">
                  <CatalogListPage kind="PRODUCT" basePath="/admin/produits" />
                </RequirePermission>
              }
            />
            <Route
              path="produits/:id"
              element={
                <RequirePermission permission="products.write">
                  <CatalogEditPage kind="PRODUCT" basePath="/admin/produits" />
                </RequirePermission>
              }
            />
            <Route
              path="projets"
              element={
                <RequirePermission permission="projects.write">
                  <CatalogListPage kind="PROJECT" basePath="/admin/projets" />
                </RequirePermission>
              }
            />
            <Route
              path="projets/:id"
              element={
                <RequirePermission permission="projects.write">
                  <CatalogEditPage kind="PROJECT" basePath="/admin/projets" />
                </RequirePermission>
              }
            />
            <Route
              path="reseaux"
              element={
                <RequirePermission permission="projects.write">
                  <SocialPublicationsPage />
                </RequirePermission>
              }
            />
            <Route
              path="accueil"
              element={
                <RequirePermission permission="pages.write">
                  <PageEditor pageKey="home" />
                </RequirePermission>
              }
            />
            <Route
              path="a-propos"
              element={
                <RequirePermission permission="pages.write">
                  <PageEditor pageKey="about" />
                </RequirePermission>
              }
            />
            <Route
              path="expertises"
              element={
                <RequirePermission permission="pages.write">
                  <PageEditor pageKey="expertises" />
                </RequirePermission>
              }
            />
            <Route
              path="whatsapp"
              element={
                <RequirePermission permission="pages.write">
                  <WhatsAppSettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="contacts"
              element={
                <RequirePermission permission="contacts.read">
                  <ContactsPage />
                </RequirePermission>
              }
            />
            <Route
              path="utilisateurs"
              element={
                <RequirePermission permission="users.manage">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit"
              element={
                <RequirePermission permission="audit.read">
                  <AuditPage />
                </RequirePermission>
              }
            />
            <Route path="*" element={<AdminHomeRedirect />} />
          </Route>

          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="projets" element={<ProjectsPage />} />
            <Route path="projets/:slug" element={<ProjectDetailPage />} />
            <Route path="produits" element={<ProductsPage />} />
            <Route path="produits/:slug" element={<ProductDetailPage />} />
            <Route path="a-propos" element={<AboutPage />} />
            <Route path="expertises" element={<ExpertisesPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
