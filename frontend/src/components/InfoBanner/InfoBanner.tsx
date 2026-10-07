import Button from '@/components/Button/Button';
import { bannerContent } from '@/data/home';
import './InfoBanner.css';

function InfoBanner() {
  return (
    <section className="info-banner">
      <div className="content-text">
        <h2>{bannerContent.title}</h2>
        <h4>{bannerContent.subtitle}</h4>
        <div className="button">
          <div className="info-banner__button">
            <Button variant="primary">{bannerContent.buttonLabel}</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default InfoBanner;
