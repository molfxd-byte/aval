import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AgreementCard from '@/components/AgreementCard/AgreementCard';
import Button from '@/components/Button/Button';
import InputSearch from '@/components/InputSearch/InputSearch';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import {
  agreementAssets,
  departments,
  obligacionesAgreements,
  obligacionesContent,
  pageSizeOptions,
} from '@/data/agreements';
import './ObligacionesAval.css';

const RETURN_PATH =
  'M25.37,48.24c.07.64.36,1.26.86,1.73l15.69,15.63c.57.57,1.21.83,1.93.83,1.48,0,2.57-1.09,2.57-2.54,0-.74-.31-1.4-.79-1.88l-5.36-5.41-6.91-6.15,5.14.19h29.41c1.6,0,2.69-1.07,2.69-2.64s-1.1-2.64-2.69-2.64h-29.41l-5.12.19,6.88-6.15,5.36-5.41c.48-.47.79-1.14.79-1.9,0-1.45-1.1-2.52-2.57-2.52-.71,0-1.36.26-1.93.83l-15.69,15.63c-.5.47-.79,1.09-.86,1.73';

function ObligacionesAval() {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [page, setPage] = useState(1);
  const departmentRef = useRef<HTMLDivElement>(null);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const term = appliedQuery.trim().toLowerCase();
    return obligacionesAgreements.filter((item) => {
      const matchesName = !term || item.name.toLowerCase().includes(term) || item.id.includes(term);
      const matchesDepartment = !department || !item.department || item.department === department;
      return matchesName && matchesDepartment;
    });
  }, [appliedQuery, department]);

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
    setAppliedQuery(query);
    setPage(1);
  };

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(next, 1), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MainLayout>
      <div className="agreements-view">
        <div className="agreements-view__hero">
          <div className="agreements">
            <nav className="pos-header" aria-label="Miga de pan">
              {obligacionesContent.crumbs.map((crumb, index) => (
                <span key={crumb.label} className="pos-header__item">
                  {crumb.href ? (
                    <Link to={crumb.href} className="redirectTitle">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="currentlyTitle">{crumb.label}</span>
                  )}
                  {index < obligacionesContent.crumbs.length - 1 && (
                    <strong className={index < obligacionesContent.crumbs.length - 2 ? 'redirectTitle' : 'currentlyTitle'}>
                      {' '}
                      /{' '}
                    </strong>
                  )}
                </span>
              ))}
            </nav>

            <div className="hero">
              <div className="hero__title">
                <h1>{obligacionesContent.title}</h1>
              </div>
              <div className="hero__text">
                <p>{obligacionesContent.paragraph}</p>
              </div>
              <div className="hero__img">
                <img src={agreementAssets.hero} alt="" />
              </div>
              <div className="hero__return">
                <Link to="/" className="return-link">
                  <svg viewBox="0 0 96 96" aria-hidden="true">
                    <path d={RETURN_PATH} />
                  </svg>
                  {obligacionesContent.returnLabel}
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
                label={obligacionesContent.searchLabel}
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
                  {department || obligacionesContent.departmentPlaceholder}
                </button>
                <span className="department__label">{obligacionesContent.departmentLabel}</span>
                {departmentOpen && (
                  <div className="department__menu">
                    <button
                      type="button"
                      onClick={() => {
                        setDepartment('');
                        setDepartmentOpen(false);
                        setPage(1);
                      }}
                    >
                      Todos
                    </button>
                    {departments.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setDepartment(item);
                          setDepartmentOpen(false);
                          setPage(1);
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
                  {obligacionesContent.searchButton}
                </Button>
              </div>
            </div>
          </div>

          <div className="results-bar">
            <div className="page-size" ref={pageSizeRef}>
              <span>{obligacionesContent.showLabel}</span>
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
                        setPageSize(option);
                        setPage(1);
                        setPageSizeOpen(false);
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
                {endIndex} {obligacionesContent.resultsOf} {filtered.length} {obligacionesContent.resultsLabel}
              </p>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="agreements-view__empty">{obligacionesContent.emptyMessage}</p>
          ) : (
            <div className="agreements-grid">
              {visible.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} />
              ))}
            </div>
          )}

          {filtered.length > pageSize && (
            <>
              <nav className="pager" aria-label="Paginación">
                <button type="button" className="page-control" onClick={() => goToPage(currentPage - 1)} aria-label="Anterior">
                  ❮
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    className={`page-number ${number === currentPage ? 'active' : ''}`}
                    onClick={() => goToPage(number)}
                  >
                    {number}
                  </button>
                ))}
                <button type="button" className="page-control" onClick={() => goToPage(currentPage + 1)} aria-label="Siguiente">
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

        <div className="floating-pay">
          <a className="floating-pay__btn" href="#buscar-convenio">
            <span className="floating-pay__icon" aria-hidden="true" />
            <span className="floating-pay__text">{obligacionesContent.floatingLabel}</span>
          </a>
        </div>
      </div>
    </MainLayout>
  );
}

export default ObligacionesAval;
