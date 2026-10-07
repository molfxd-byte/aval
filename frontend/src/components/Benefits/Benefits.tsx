import SliderChevron from '@/components/SliderChevron/SliderChevron';
import { benefitSlides, benefitsContent } from '@/data/home';
import { useCarousel } from '@/hooks/useCarousel';
import './Benefits.css';

function PointDecoration() {
  return (
    <div className="container-point-decoration" aria-hidden="true">
      <div className="circle-decoration navy" />
      <div className="circle-decoration red" />
      <div className="circle-decoration lightblue" />
      <div className="circle-decoration green" />
    </div>
  );
}

interface DotsProps {
  active: number;
  onSelect: (index: number) => void;
  className?: string;
}

function Dots({ active, onSelect, className = '' }: DotsProps) {
  return (
    <div className={`dots-container-benf ${className}`}>
      {benefitSlides.map((slide, i) => (
        <button
          key={slide.id}
          type="button"
          className={`slider-dot ${i === active ? 'active' : ''}`}
          aria-label={`Ir al beneficio ${i + 1}`}
          aria-current={i === active}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}

function Benefits() {
  const { active, goTo, next, prev, swipeHandlers } = useCarousel(benefitSlides.length);

  return (
    <section
      className="benefits main-apc no-seleccion"
      aria-roledescription="carrusel"
      aria-label={benefitsContent.title}
      {...swipeHandlers}
    >
      <div className="slider-container-benf" style={{ transform: `translateX(-${active * 100}%)` }}>
        {benefitSlides.map((slide, i) => (
          <div key={slide.id} className="slider-benf benefits" aria-hidden={i !== active}>
            <div className="container-mobile benefits">
              <div className="container-title">
                <h3>{benefitsContent.title}</h3>
              </div>
              <PointDecoration />
            </div>

            <div className="container-left benefits">
              <div className="left-full">
                <img src={slide.images.full} alt="" />
              </div>
              <div className="left-half pt-16">
                <img src={slide.images.halfTop} alt="" />
              </div>
              <div className="left-half pt-16">
                <img className="img-bottom" src={slide.images.halfBottom} alt="" />
              </div>
            </div>

            <div className="container-mobile container-down benefits">
              <h4>{slide.subtitle}</h4>
              <p>{slide.text}</p>
            </div>

            <div className="container-right benefits">
              <div className="subcontainer-right benefits">
                <div className="container-title benefits">
                  <h3>{benefitsContent.title}</h3>
                </div>
                <PointDecoration />
                <div className="container-subtitle benefits">
                  <h4>{slide.subtitle}</h4>
                </div>
                <div className="container-text benefits">
                  <p>{slide.text}</p>
                </div>
                <div className="slider-nav">
                  <button
                    type="button"
                    className="slider-back-benf"
                    aria-label="Beneficio anterior"
                    onClick={prev}
                  >
                    <SliderChevron direction="left" />
                  </button>
                  <Dots active={active} onSelect={goTo} />
                  <button
                    type="button"
                    className="slider-next-benf"
                    aria-label="Beneficio siguiente"
                    onClick={next}
                  >
                    <SliderChevron direction="right" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dots active={active} onSelect={goTo} className="dots-mobile benefits" />
    </section>
  );
}

export default Benefits;
