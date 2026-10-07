import { images } from '@/assets/images';
import { footerContact, footerLinks } from '@/data/home';
import './Footer.css';

const banks = ['bogota', 'occidente', 'popular', 'avvillas'] as const;

function Footer() {
  return (
    <footer className="footer-container">
      <img className="img-vigilado" src={images.vigilado} alt="Vigilado Superintendencia Financiera de Colombia" />
      <div className="content">
        <div className="footer__inner">
          <div className="image-aval">
            {banks.map((bank) => (
              <span key={bank} className={`bank-img bank-${bank}`} role="img" aria-label={`Banco ${bank}`} />
            ))}
            <span className="line" />
            <img className="aval-logo" src={images.logoGrupoAvalFooter} alt="Grupo Aval" />
          </div>

          <img className="image-norton" src={images.logoNorton} alt="Norton Secured" />

          <div className="contact">
            {footerContact.map((item) => (
              <p key={item.label}>
                {item.label} <a href={item.href}>{item.value}</a>
              </p>
            ))}
          </div>

          <div className="media">
            <div className="urls">
              {footerLinks.map((link) => (
                <a key={link.label} href={link.href}>
                  <p>{link.label}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
