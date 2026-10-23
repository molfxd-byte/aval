import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { obligacionesContent } from '@/data/agreements';
import { getPayment } from '@/data/payments';
import { getConjuntoPayment } from '@/data/conjuntosResidenciales';
import { getCatalogPaymentById } from '@/data/catalogStore';
import { getSaludPayment } from '@/data/saludMedicina';
import { getServicioPayment } from '@/data/serviciosPublicos';
import type { Agreement } from '@/data/agreements';
import './AgreementCard.css';

interface AgreementCardProps {
  agreement: Agreement;
  payBase?: string;
  onDelay?: (action: () => void) => void;
}

function AgreementCard({ agreement, payBase = '/obligaciones-aval/pagar', onDelay }: AgreementCardProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const payment =
    getPayment(agreement.id) ??
    getServicioPayment(agreement.id) ??
    getConjuntoPayment(agreement.id) ??
    getSaludPayment(agreement.id) ??
    getCatalogPaymentById(agreement.id);
  const payTo = `${payBase}/${agreement.id}`;

  const openCard = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (onDelay) onDelay(() => setOpen(true));
    else setOpen(true);
  };

  return (
    <article className={`agreement-card ${open ? 'is-open' : ''}`}>
      <button type="button" className="card__initial" onClick={openCard}>
        <div className="card__initial_half_top">
          <img src={agreement.logo} alt="" />
        </div>
        <div className="card__initial_half_bottom">
          <h4>{agreement.name}</h4>
        </div>
      </button>
      <div className="card__hover">
        <div className="card__hover_buttons">
          {payment ? (
            <Link
              className="btn btn-primary"
              to={payTo}
              onClick={(event) => {
                if (!onDelay) return;
                event.preventDefault();
                onDelay(() => navigate(payTo));
              }}
            >
              <span>{obligacionesContent.payLabel}</span>
            </Link>
          ) : (
            <Button variant="primary">{obligacionesContent.payLabel}</Button>
          )}
          {agreement.acceptsEnrollment && <Button variant="secondary">{obligacionesContent.enrollLabel}</Button>}
        </div>
      </div>
    </article>
  );
}

export default AgreementCard;
