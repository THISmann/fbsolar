import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';

export function Layout() {
  return (
    <>
      <Header />
      <OfflineBanner />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
