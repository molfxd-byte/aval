import FastPaymentCard from '@/components/FastPaymentCard/FastPaymentCard';
import TextLink from '@/components/TextLink/TextLink';
import { fastPayments, fastPaymentsContent } from '@/data/home';
import './FastPayments.css';

function FastPayments() {
  const { title, linkLabel, linkHref } = fastPaymentsContent;

  return (
    <section className="payment-container">
      <div className="payment-container__header">
        <h4>{title}</h4>
        <TextLink href={linkHref}>{linkLabel}</TextLink>
      </div>

      <div className="content-container">
        {fastPayments.map((payment) => (
          <div key={payment.id} className="content-container__item">
            <FastPaymentCard payment={payment} />
          </div>
        ))}
      </div>

      <div className="mobile-content">
        <TextLink href={linkHref}>{linkLabel}</TextLink>
      </div>
    </section>
  );
}

export default FastPayments;
