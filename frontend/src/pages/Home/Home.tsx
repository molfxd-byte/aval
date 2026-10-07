import MainLayout from '@/layouts/MainLayout/MainLayout';
import SearchBar from '@/components/SearchBar/SearchBar';
import FastPayments from '@/components/FastPayments/FastPayments';
import Benefits from '@/components/Benefits/Benefits';
import News from '@/components/News/News';
import InfoBanner from '@/components/InfoBanner/InfoBanner';
import PaymentMethods from '@/components/PaymentMethods/PaymentMethods';
import './Home.css';

function Home() {
  return (
    <MainLayout>
      <div className="home">
        <div className="home__section-1">
          <SearchBar />
          <FastPayments />
        </div>

        <div className="home__section-2">
          <Benefits />
        </div>

        <div className="home__slider-type-2">
          <News />
        </div>

        <div className="home__section-3">
          <InfoBanner />
        </div>

        <div className="home__section-4">
          <PaymentMethods />
        </div>
      </div>
    </MainLayout>
  );
}

export default Home;
