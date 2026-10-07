import type { PaymentMethod } from '@/types/home';
import './PaymentMethodCard.css';

interface PaymentMethodCardProps {
  method: PaymentMethod;
}

function PaymentMethodCard({ method }: PaymentMethodCardProps) {
  return (
    <article className={`payment-method-card ${method.logoClass}`}>
      <img className="card-image" src={method.image} alt={method.title} />
      <p className="card-title">{method.title}</p>
      <p className="card-paragraph">{method.description}</p>
    </article>
  );
}

export default PaymentMethodCard;
