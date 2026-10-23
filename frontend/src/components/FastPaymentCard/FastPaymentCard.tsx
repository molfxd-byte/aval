import { Link } from 'react-router-dom';
import type { FastPayment } from '@/types/home';
import './FastPaymentCard.css';

interface FastPaymentCardProps {
  payment: FastPayment;
  onDelay?: (href: string) => void;
}

function FastPaymentCard({ payment, onDelay }: FastPaymentCardProps) {
  return (
    <Link
      to={payment.href}
      className="fast-payment-card"
      onClick={(event) => {
        if (!onDelay) return;
        event.preventDefault();
        onDelay(payment.href);
      }}
    >
      {payment.isNew && (
        <div className="container-new">
          <span className="new">Nuevo</span>
        </div>
      )}
      <img src={payment.image} className={payment.imageClass} alt="" />
      <h4>{payment.title}</h4>
    </Link>
  );
}

export default FastPaymentCard;
