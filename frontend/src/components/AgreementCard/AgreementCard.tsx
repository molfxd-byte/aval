import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { obligacionesContent } from '@/data/agreements';
import { getPayment } from '@/data/payments';
import type { Agreement } from '@/data/agreements';
import './AgreementCard.css';

interface AgreementCardProps {
  agreement: Agreement;
}

function AgreementCard({ agreement }: AgreementCardProps) {
  const [open, setOpen] = useState(false);
  const payment = getPayment(agreement.id);

  return (
    <article className={`agreement-card ${open ? 'is-open' : ''}`}>
      <button type="button" className="card__initial" onClick={() => setOpen((value) => !value)}>
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
            <Link className="btn btn-primary" to={`/obligaciones-aval/pagar/${agreement.id}`}>
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
