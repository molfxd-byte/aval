import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AgreementCard from '@/components/AgreementCard/AgreementCard';
import Button from '@/components/Button/Button';
import ElementColors from '@/components/ElementColors/ElementColors';
import InputSearch from '@/components/InputSearch/InputSearch';
import PageLoader from '@/components/PageLoader/PageLoader';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import {
  agreementAssets,
  departments,
  obligacionesAgreements,
  obligacionesContent,
  pageSizeOptions,
} from '@/data/agreements';
import type { Agreement } from '@/data/agreements';
import './ObligacionesAval.css';

type PageToken = number | 'dots';

function pageTokens(current: number, total: number): PageToken[] {
  const included = new Set<number>([1, total]);
  if (current <= 3) {
    included.add(2);
    included.add(3);
  } else if (current >= total - 2) {
    included.add(total - 2);
    included.add(total - 1);
  } else {
    included.add(current);
  }

  const pages = [...included].filter((number) => number >= 1 && number <= total).sort((left, right) => left - right);
  const tokens: PageToken[] = [];
  pages.forEach((number, index) => {
    if (index > 0 && number - pages[index - 1] > 1) tokens.push('dots');
    tokens.push(number);
  });
  return tokens;
}

const RETURN_PATH =
  'M25.37,48.24c.07.64.36,1.26.86,1.73l15.69,15.63c.57.57,1.21.83,1.93.83,1.48,0,2.57-1.09,2.57-2.54,0-.74-.31-1.4-.79-1.88l-5.36-5.41-6.91-6.15,5.14.19h29.41c1.6,0,2.69-1.07,2.69-2.64s-1.1-2.64-2.69-2.64h-29.41l-5.12.19,6.88-6.15,5.36-5.41c.48-.47.79-1.14.79-1.9,0-1.45-1.1-2.52-2.57-2.52-.71,0-1.36.26-1.93.83l-15.69,15.63c-.5.47-.79,1.09-.86,1.73';

function ObligacionesAval({
  content = obligacionesContent,
  agreements = obligacionesAgreements,
  payBase = '/obligaciones-aval/pagar',
  hero = agreementAssets.hero,
}: {
  content?: typeof obligacionesContent;
  agreements?: Agreement[];
  payBase?: string;
  hero?: string;
}) {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const departmentRef = useRef<HTMLDivElement>(null);
  const pageSizeRef = useRef<HTMLDivElement>(null);
  const loaderTimer = useRef<number | undefined>(undefined);

  const showLoader = (action: () => void) => {
    window.clearTimeout(loaderTimer.current);
    setLoading(true);
    loaderTimer.current = window.setTimeout(() => {
      action();
      setLoading(false);
    }, 2000);
  };

  useEffect(() => () => window.clearTimeout(loaderTimer.current), []);

  const filtered = useMemo(() => {
    const term = appliedQuery.trim().toLowerCase();
    return agreements.filter((item) => {
      const matchesName = !term || item.name.toLowerCase().includes(term) || item.id.includes(term);
      const matchesDepartment = !department || !item.department || item.department === department;
      return matchesName && matchesDepartment;
    });
  }, [appliedQuery, department, agreements]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const endIndex = filtered.length === 0 ? 0 : Math.min(currentPage * pageSize, filtered.length);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!departmentRef.current?.contains(event.target as Node)) setDepartmentOpen(false);
      if (!pageSizeRef.current?.contains(event.target as Node)) setPageSizeOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = () => {
    showLoader(() => {
      setAppliedQuery(query);
      setPage(1);
    });
  };

  const goToPage = (next: number) => {
    const target = Math.min(Math.max(next, 1), totalPages);
    if (target === currentPage) return;
    showLoader(() => {
      setPage(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <MainLayout>
      <div className="agreements-view">
        <div className="agreements-view__hero">
          <div className="agreements">
            <nav className="pos-header" aria-label="Miga de pan">
              {content.crumbs.map((crumb, index) => (
                <span key={crumb.label} className="pos-header__item">
                  {crumb.href ? (
                    <Link to={crumb.href} className="redirectTitle">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="currentlyTitle">{crumb.label}</span>
                  )}
                  {index < content.crumbs.length - 1 && (
                    <strong className={index < content.crumbs.length - 2 ? 'redirectTitle' : 'currentlyTitle'}>
                      {' '}
                      /{' '}
                    </strong>
                  )}
                </span>
              ))}
            </nav>

            <div className="hero">
              <div className="hero__title">
                <h1>{content.title}</h1>
                <div className="hero__colors">
                  <ElementColors />
                </div>
              </div>
              <div className="hero__text">
                <p>{content.paragraph}</p>
              </div>
              <div className="hero__img">
                <img src={hero} alt="" />
              </div>
              <div className="hero__return">
                <Link to="/" className="return-link">
                  <svg viewBox="0 0 96 96" aria-hidden="true">
                    <path d={RETURN_PATH} />
                  </svg>
                  {content.returnLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="agreements agreements-view__body">
          <div className="filters" id="buscar-convenio">
            <div className="filters__search">
              <InputSearch
                value={query}
                onChange={setQuery}
                onSubmit={search}
                label={content.searchLabel}
                strong
              />
            </div>
            <div className="filters__actions">
              <div className="department" ref={departmentRef}>
                <button
                  type="button"
                  className="department__input"
                  onClick={() => setDepartmentOpen((value) => !value)}
                >
                  {department || content.departmentPlaceholder}
                </button>
                <span className="department__label">{content.departmentLabel}</span>
                {departmentOpen && (
                  <div className="department__menu">
                    <button
                      type="button"
                      onClick={() => {
                        setDepartmentOpen(false);
                        showLoader(() => {
                          setDepartment('');
                          setPage(1);
                        });
                      }}
                    >
                      Todos
                    </button>
                    {departments.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setDepartmentOpen(false);
                          showLoader(() => {
                            setDepartment(item);
                            setPage(1);
                          });
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="filters__button">
                <Button variant="primary" onClick={search}>
                  {content.searchButton}
                </Button>
              </div>
            </div>
          </div>

          <div className="results-bar">
            <div className="page-size" ref={pageSizeRef}>
              <span>{content.showLabel}</span>
              <button type="button" className="page-size__toggle" onClick={() => setPageSizeOpen((value) => !value)}>
                <span>{pageSize}</span>
                <img src={pageSizeOpen ? agreementAssets.pageSizeOpen : agreementAssets.pageSizeClosed} alt="" />
              </button>
              {pageSizeOpen && (
                <div className="page-size__menu">
                  {pageSizeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setPageSizeOpen(false);
                        showLoader(() => {
                          setPageSize(option);
                          setPage(1);
                        });
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filtered.length > 0 && (
              <p className="results-bar__text">
                {endIndex} {content.resultsOf} {filtered.length} {content.resultsLabel}
              </p>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="agreements-view__empty">{content.emptyMessage}</p>
          ) : (
            <div className="agreements-grid">
              {visible.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} payBase={payBase} onDelay={showLoader} />
              ))}
            </div>
          )}

          {filtered.length > pageSize && (
            <>
              <nav className="pager" aria-label="Paginación">
                <button
                  type="button"
                  className="page-control"
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Anterior"
                  disabled={currentPage === 1}
                >
                  ❮
                </button>
                {pageTokens(currentPage, totalPages).map((token, index) =>
                  token === 'dots' ? (
                    <span key={`dots-${index}`} className="pager-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <button
                      key={token}
                      type="button"
                      className={`page-number ${token === currentPage ? 'active' : ''}`}
                      onClick={() => goToPage(token)}
                    >
                      {token}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="page-control"
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Siguiente"
                  disabled={currentPage === totalPages}
                >
                  ❯
                </button>
              </nav>
              <nav className="pager-mobile" aria-label="Paginación">
                <button type="button" className="page-control" onClick={() => goToPage(currentPage - 1)} aria-label="Anterior">
                  ❮
                </button>
                <span className="current-page">{currentPage}</span>
                <span className="bold-slash">/</span>
                <span className="total-pages">{totalPages}</span>
                <button type="button" className="page-control" onClick={() => goToPage(currentPage + 1)} aria-label="Siguiente">
                  ❯
                </button>
              </nav>
            </>
          )}
        </div>

        {loading && <PageLoader />}

        <div className="floating-pay">
          <a className="floating-pay__btn" href="#buscar-convenio">
            <span className="floating-pay__icon" aria-hidden="true" />
            <span className="floating-pay__text">{content.floatingLabel}</span>
          </a>
        </div>
      </div>
    </MainLayout>
  );
}

export default ObligacionesAval;
