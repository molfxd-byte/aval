import PaymentMethodCard from '@/components/PaymentMethodCard/PaymentMethodCard';
import { paymentMethods, paymentMethodsContent } from '@/data/home';
import './PaymentMethods.css';

function PaymentMethods() {
  return (
    <section className="payment-methods">
      <h3>{paymentMethodsContent.title}</h3>
      <p>{paymentMethodsContent.description}</p>
      <div className="payment-methods__cards">
        {paymentMethods.map((method) => (
          <div key={method.id} className="payment-methods__item">
            <PaymentMethodCard method={method} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default PaymentMethods;
