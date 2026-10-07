import SliderChevron from '@/components/SliderChevron/SliderChevron';
import { newsSlides } from '@/data/home';
import { useCarousel } from '@/hooks/useCarousel';
import './News.css';

interface DotsProps {
  active: number;
  onSelect: (index: number) => void;
  className?: string;
}

function Dots({ active, onSelect, className = '' }: DotsProps) {
  return (
    <div className={`dots-container-NEWS ${className}`}>
      {newsSlides.map((slide, i) => (
        <button
          key={slide.id}
          type="button"
          className={`slider-dot ${i === active ? 'active' : ''}`}
          aria-label={`Ir a la novedad ${i + 1}`}
          aria-current={i === active}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}

function News() {
  const { active, goTo, next, prev, swipeHandlers } = useCarousel(newsSlides.length);

  return (
    <section className="news main-apc mobile-news no-seleccion" aria-roledescription="carrusel" {...swipeHandlers}>
      <div className="background-div" />

      <div className="slider-container-NEWS mobile-news" style={{ transform: `translateX(-${active * 100}%)` }}>
        {newsSlides.map((slide, i) => (
          <div key={slide.id} className="card-container" aria-hidden={i !== active}>
            <div className={`card-blue ${i === active ? 'active' : ''}`}>
              <div className="slider-NEWS mobile-news">
                <div className="container-left mobile-news">
                  <div className="subcontainer-left mobile-news">
                    <div className="container-title mobile-news">
                      <h3>{slide.title}</h3>
                    </div>
                    <div className="container-text mt-16 mobile-news">
                      <p>{slide.text}</p>
                    </div>
                    <div className="container-button mobile-news">
                      <a href={slide.href} tabIndex={i === active ? 0 : -1}>
                        <span className="button-apc">{slide.buttonLabel}</span>
                      </a>
                    </div>
                  </div>
                  <div className="container-mobile container-down mobile-news">
                    <h3>{slide.title}</h3>
                    <p>{slide.text}</p>
                  </div>
                </div>
                <div className="container-right mobile-news">
                  <img src={slide.image} alt="" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="content-navs mobile-news">
        <div className="slider-nav">
          <button type="button" className="slider-back-NEWS" aria-label="Novedad anterior" onClick={prev}>
            <SliderChevron direction="left" />
          </button>
          <Dots active={active} onSelect={goTo} />
          <button type="button" className="slider-next-NEWS" aria-label="Novedad siguiente" onClick={next}>
            <SliderChevron direction="right" />
          </button>
        </div>
      </div>

      <div className="container-mobile container-down">
        <Dots active={active} onSelect={goTo} className="dots-mobile mobile-news" />
      </div>
    </section>
  );
}

export default News;
