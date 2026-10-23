import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ElementColors from '@/components/ElementColors/ElementColors';
import FastPaymentCard from '@/components/FastPaymentCard/FastPaymentCard';
import PageLoader from '@/components/PageLoader/PageLoader';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import {
  categoryCards,
  featuredCategories,
  queQuieresPagarContent,
} from '@/data/queQuieresPagar';
import type { FastPayment } from '@/types/home';
import './QueQuieresPagar.css';

function CategoryRow({ category, onOpen }: { category: FastPayment; onOpen: (href: string) => void }) {
  const content = (
    <>
      <img src={category.image} alt="" />
      <h4>{category.title}</h4>
    </>
  );

  if (!category.href) {
    return <article className="category-row">{content}</article>;
  }

  return (
    <a
      className="category-row"
      href={category.href}
      onClick={(event) => {
        event.preventDefault();
        onOpen(category.href);
      }}
    >
      {content}
    </a>
  );
}

function QueQuieresPagar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const loaderTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(loaderTimer.current), []);

  const openCategory = (href: string) => {
    window.clearTimeout(loaderTimer.current);
    setLoading(true);
    loaderTimer.current = window.setTimeout(() => {
      navigate(href);
    }, 2000);
  };

  return (
    <MainLayout>
      <div className="pay-today">
        <div className="pay-today__inner">
          <nav className="pay-today__crumbs" aria-label="Miga de pan">
            {queQuieresPagarContent.crumbs.map((crumb, index) => (
              <span key={crumb.label}>
                {crumb.href ? (
                  <Link to={crumb.href} className="pay-today__crumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="pay-today__crumb-current">{crumb.label}</span>
                )}
                {index < queQuieresPagarContent.crumbs.length - 1 && (
                  <strong className="pay-today__crumb-current"> / </strong>
                )}
              </span>
            ))}
          </nav>

          <div className="pay-today__intro">
            <div className="pay-today__title">
              <h1>{queQuieresPagarContent.title}</h1>
              <ElementColors />
            </div>
            <div className="pay-today__featured">
              {featuredCategories.map((category) => (
                <FastPaymentCard key={category.id} payment={category} onDelay={openCategory} />
              ))}
            </div>
          </div>

          <div className="pay-today__grid">
            {categoryCards.map((category) => (
              <CategoryRow key={category.id} category={category} onOpen={openCategory} />
            ))}
          </div>
        </div>

        <div className="floating-pay">
          <Link className="floating-pay__btn" to="/">
            <span className="floating-pay__icon" aria-hidden="true" />
            <span className="floating-pay__text">{queQuieresPagarContent.floatingLabel}</span>
          </Link>
        </div>

        {loading && <PageLoader />}
      </div>
    </MainLayout>
  );
}

export default QueQuieresPagar;
