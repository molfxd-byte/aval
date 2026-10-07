import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import ElementColors from '@/components/ElementColors/ElementColors';
import Button from '@/components/Button/Button';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import { obligacionesAgreements } from '@/data/agreements';
import { getPayment, paymentAssets } from '@/data/payments';
import type { PaymentField } from '@/data/payments';
import './PagoConvenio.css';

const steps = [
  {
    number: '1',
    title: 'Datos de tu pago',
    description:
      'Ingresa los datos necesarios para realizar tu pago, recuerda que los campos con asterisco son obligatorios. Lee y acepta términos y condiciones.',
  },
  { number: '2', title: 'Realiza tu pago seguro' },
  { number: '3', title: 'Recibe tu comprobante' },
];

function formatMoney(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '$ 0';
  return `$ ${Number(digits).toLocaleString('es-CO')}`;
}

function PagoConvenio() {
  const { id = '' } = useParams();
  const payment = getPayment(id);
  const agreement = obligacionesAgreements.find((item) => item.id === id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState('');
  const [method, setMethod] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const referencesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValues({});
    setOpenSelect(null);
    setAmountFocused(false);
    setDetailOpen(false);
    setDetail('');
    setMethod('');
    setAccepted(false);
  }, [id]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!referencesRef.current?.contains(event.target as Node)) setOpenSelect(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const setValue = (fieldId: string, value: string) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  if (!payment || !agreement) {
    return <Navigate to="/obligaciones-aval" replace />;
  }

  return (
    <MainLayout>
      <section className="pay-view">
        <h1>Realiza tu pago</h1>
        <div className="pay-dots">
          <ElementColors />
        </div>

        <div className="pay-content">
          <div className="pay-info">
            <ol className="stepper">
              {steps.map((step, index) => (
                <li key={step.number} className={`stepper-item ${index === 0 ? 'doing' : ''}`}>
                  <span className="circle">{step.number}</span>
                  <div className="stepper-content">
                    <p className="stepper-headline">{step.title}</p>
                    {step.description && (
                      <>
                        <p className="stepper-description-desktop">{step.description}</p>
                        <p className="stepper-description-movil">{step.description}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <img className="pay-logo" src={agreement.logo} alt={payment.serviceName} />
          </div>

          <form className="pay-form" onSubmit={(event) => event.preventDefault()}>
            <div className="pay-name">
              <p>Servicio a pagar</p>
              <h2>{payment.serviceName}</h2>
            </div>

            {payment.helpImage && (
              <div className="pay-help">
                <img className="pay-help__desktop" src={payment.helpImage} alt="" />
                <div className="pay-help__mobile">
                  <button type="button" className="pay-help__link" onClick={() => setHelpOpen((value) => !value)}>
                    <img src={paymentAssets.helpIcon} alt="" />
                    <span>Ver imagen de ayuda</span>
                  </button>
                  {helpOpen && <img className="pay-help__preview" src={payment.helpImage} alt="" />}
                </div>
              </div>
            )}

            <div className="pay-references" ref={referencesRef}>
              {payment.fields.map((field) => (
                <PaymentControl
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ''}
                  open={openSelect === field.id}
                  amountFocused={amountFocused}
                  onChange={(value) => setValue(field.id, value)}
                  onToggle={() => setOpenSelect((current) => (current === field.id ? null : field.id))}
                  onPick={(value) => {
                    setValue(field.id, value);
                    setOpenSelect(null);
                  }}
                  onAmountFocus={() => setAmountFocused(true)}
                  onAmountBlur={() => setAmountFocused(false)}
                />
              ))}

              <div className="pay-cost">
                <p className="pay-cost__label">Valor de la transacción</p>
                <p className="pay-cost__value">{formatMoney(values.amount ?? '')}</p>
              </div>

              <div className="pay-detail">
                <div className="pay-toggle">
                  <input
                    id="payment-detail"
                    type="checkbox"
                    checked={detailOpen}
                    onChange={(event) => setDetailOpen(event.target.checked)}
                  />
                  <label className="pay-toggle__text" htmlFor="payment-detail">
                    Agregar detalle del pago
                  </label>
                  <label className="pay-toggle__slider" htmlFor="payment-detail" />
                </div>
                {detailOpen && (
                  <>
                    <hr className="pay-detail__line" />
                    <textarea
                      className="pay-detail__input"
                      placeholder="Detalle del pago"
                      value={detail}
                      onChange={(event) => setDetail(event.target.value)}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="pay-methods">
              <p className="pay-methods__lead">Selecciona el medio de pago para continuar tu transacción:</p>
              <div className="pay-methods__card">
                <p>Otros medios de pago:</p>
                <div className="pay-methods__logos">
                  {payment.methods.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`pay-methods__logo ${method === item.id ? 'is-selected' : ''}`}
                      title={item.title}
                      onClick={() => setMethod(item.id)}
                    >
                      <img src={item.logo} alt={item.title} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="pay-terms">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                Acepto <button type="button">términos y condiciones</button>
              </span>
            </label>

            <div className="pay-actions">
              <p>¡Agiliza tu pago si ya te encuentras registrado en nuestro portal!</p>
              <div className="pay-actions__buttons">
                <Button variant="primary">Pagar</Button>
                <Button variant="primary">Agiliza tu pago</Button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </MainLayout>
  );
}

interface PaymentControlProps {
  field: PaymentField;
  value: string;
  open: boolean;
  amountFocused: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onPick: (value: string) => void;
  onAmountFocus: () => void;
  onAmountBlur: () => void;
}

function PaymentControl({
  field,
  value,
  open,
  amountFocused,
  onChange,
  onToggle,
  onPick,
  onAmountFocus,
  onAmountBlur,
}: PaymentControlProps) {
  if (field.kind === 'select') {
    return (
      <div className="pay-select">
        <button type="button" className={`pay-select__input ${value ? 'has-value' : ''}`} onClick={onToggle}>
          {value || field.label}
        </button>
        {open && (
          <div className="pay-select__menu">
            <button type="button" onClick={() => onPick('')}>
              Selecciona
            </button>
            {field.options.map((option) => (
              <button key={option} type="button" onClick={() => onPick(option)}>
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.kind === 'choice') {
    const selected = value || field.options[0]?.value;

    return (
      <div className="pay-choices">
        {field.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`pay-choice ${selected === option.value ? 'is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className="pay-choice__title">{option.title}</span>
            {option.subtitle && <span className="pay-choice__subtitle">{option.subtitle}</span>}
          </button>
        ))}
      </div>
    );
  }

  if (field.kind === 'card') {
    return (
      <div className="pay-card">
        <div className="pay-card__box">
          <input
            className="pay-card__input"
            value={value}
            maxLength={field.maxLength}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, field.maxLength ?? 19))}
          />
        </div>
        <label className="pay-card__label">{field.label}</label>
      </div>
    );
  }

  if (field.kind === 'amount') {
    return (
      <FloatField
        label={field.label}
        value={value}
        maxLength={field.maxLength}
        inputMode="numeric"
        symbol={amountFocused || value.length > 0}
        onFocus={onAmountFocus}
        onBlur={onAmountBlur}
        onChange={(next) => onChange(next.replace(/\D/g, '').slice(0, field.maxLength ?? next.length))}
      />
    );
  }

  return (
    <FloatField
      label={field.label}
      value={value}
      maxLength={field.maxLength}
      inputMode={field.numeric ? 'numeric' : 'text'}
      onChange={(next) => {
        const cleaned = field.numeric ? next.replace(/\D/g, '') : next.replace(/[^\dA-Za-z]/g, '');
        onChange(field.maxLength ? cleaned.slice(0, field.maxLength) : cleaned);
      }}
    />
  );
}

interface FloatFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  maxLength?: number;
  inputMode?: 'text' | 'numeric';
  symbol?: boolean;
}

function FloatField({ label, value, onChange, onFocus, onBlur, maxLength, inputMode = 'text', symbol = false }: FloatFieldProps) {
  const [focused, setFocused] = useState(false);
  const raised = focused || value.length > 0;

  return (
    <div className="pay-field">
      <div className="pay-field__box">
        <input
          className={`pay-field__input ${symbol ? 'has-symbol' : ''}`}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />
        <label className={`pay-field__label ${raised ? 'is-raised' : ''}`}>{label}</label>
        {symbol && <img className="pay-field__symbol" src={paymentAssets.paySymbol} alt="" />}
      </div>
    </div>
  );
}

export default PagoConvenio;
