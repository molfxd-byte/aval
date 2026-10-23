import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { images } from '@/assets/images';
import Button from '@/components/Button/Button';
import MenuItem from '@/components/MenuItem/MenuItem';
import { navItems } from '@/data/home';
import './Header.css';

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isPayment = pathname.includes('/pagar/');

  const renderNav = (items = navItems) =>
    items.map((item) => (
      <li key={item.label} className="menu__item">
        {item.children ? (
          <MenuItem item={item} />
        ) : (
          <a href={item.href} className={item.href === pathname ? 'active' : ''}>
            {item.label}
          </a>
        )}
      </li>
    ));

  return (
    <header className="header-container">
      <div className="header-content">
        <div className="header-images">
          <a href="/" className="header-images-logo img-apc">
            <img src={images.logoAvalPayCenter} alt="AvalPay Center" />
          </a>
          <div className="divider" />
          <div className="header-images-logos">
            <img src={images.logoGrupoAvalHeader} alt="Grupo Aval" />
          </div>
        </div>

        <nav className="header-options menu">
          <ul>{renderNav()}</ul>
        </nav>

        <div className="header-buttons">
          {isPayment ? (
            <Link to="/" className="header-return">
              Volver al Inicio
            </Link>
          ) : (
            <Button variant="secondary">Regístrate</Button>
          )}
        </div>

        <div className="header-menu-mobile">
          <div
            className="menu-container"
            role="button"
            tabIndex={0}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            onKeyDown={(e) => e.key === 'Enter' && setMobileOpen((prev) => !prev)}
          >
            <span>Menú</span>
            <div className="menu-btn">
              <div className="btn-hamburger" />
              <div className="btn-hamburger" />
              <div className="btn-hamburger" />
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="header-mobile-panel menu">
          <ul>{renderNav(navItems.filter((item) => !item.children))}</ul>
          <div className="header-mobile-panel__buttons">
            <Button variant="secondary">Regístrate</Button>
            <Button variant="primary">Ingresa</Button>
          </div>
        </nav>
      )}
    </header>
  );
}

export default Header;
