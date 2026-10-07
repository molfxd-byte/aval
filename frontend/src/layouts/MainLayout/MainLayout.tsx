import type { ReactNode } from 'react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import HelpButton from '@/components/HelpButton/HelpButton';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="main-layout">
      <Header />
      <main className="main-layout__content">{children}</main>
      <Footer />
      <HelpButton />
    </div>
  );
}

export default MainLayout;
