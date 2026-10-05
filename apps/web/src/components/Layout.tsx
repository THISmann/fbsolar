import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import { SiteWhatsApp } from './WhatsAppFloat';

export function Layout() {
  return (
    <>
      <Header />
      <OfflineBanner />
      <main>
        <Outlet />
      </main>
      <Footer />
      <SiteWhatsApp />
    </>
  );
}
