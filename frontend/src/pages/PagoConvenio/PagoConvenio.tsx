import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ElementColors from '@/components/ElementColors/ElementColors';
import Button from '@/components/Button/Button';
import PageLoader from '@/components/PageLoader/PageLoader';
import MainLayout from '@/layouts/MainLayout/MainLayout';
import { obligacionesAgreements } from '@/data/agreements';
import { getPayment, paymentAssets } from '@/data/payments';
import type { PaymentField, PaymentView } from '@/data/payments';
import { getConjuntoPayment, conjuntosAgreements } from '@/data/conjuntosResidenciales';
import { getSaludPayment, saludAgreements } from '@/data/saludMedicina';
import { getServicioPayment, serviciosAgreements } from '@/data/serviciosPublicos';
import { getCatalogAgreement, getCatalogPayment, isCatalogSource } from '@/data/catalogStore';
import { createTransactionId, savePasarelaSession } from '@/data/pasarela';
import type { PasarelaSession } from '@/data/pasarela';
import brebQr from '@/assets/images/Breb/breb-qr.jpg';
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

function formatAmountDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
}

function PagoConvenio({ source = 'obligaciones' }: { source?: string }) {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const catalog = isCatalogSource(source);
  const payment: PaymentView | undefined = catalog
    ? getCatalogPayment(source, id)
    : source === 'servicios'
      ? getServicioPayment(id)
      : source === 'conjuntos'
        ? getConjuntoPayment(id)
        : source === 'salud'
          ? getSaludPayment(id)
          : getPayment(id);
  const agreement = catalog
    ? getCatalogAgreement(source, id)
    : source === 'servicios'
      ? serviciosAgreements.find((item) => item.id === id)
      : source === 'conjuntos'
        ? conjuntosAgreements.find((item) => item.id === id)
        : source === 'salud'
          ? saludAgreements.find((item) => item.id === id)
          : obligacionesAgreements.find((item) => item.id === id);
  const backTo = catalog
    ? `/${source}`
    : source === 'servicios'
      ? '/servicios-publicos'
      : source === 'conjuntos'
        ? '/conjuntos-residenciales'
        : source === 'salud'
          ? '/salud-medicina'
          : '/obligaciones-aval';
  const [values, setValues] = useState<Record<string, string>>({});
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState('');
  const [method, setMethod] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [brebQrOpen, setBrebQrOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const referencesRef = useRef<HTMLDivElement>(null);
  const loaderTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setValues({});
    setOpenSelect(null);
    setAmountFocused(false);
    setDetailOpen(false);
    setDetail('');
    setMethod('');
    setAccepted(false);
    setHelpOpen(false);
    setZoomOpen(false);
    setBrebQrOpen(false);
    setLoading(false);
    window.clearTimeout(loaderTimer.current);
  }, [id]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!referencesRef.current?.contains(event.target as Node)) setOpenSelect(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => () => window.clearTimeout(loaderTimer.current), []);

  const setValue = (fieldId: string, value: string) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handlePay = (event: FormEvent) => {
    event.preventDefault();
    if (!payment || !agreement || loading) return;
    if (method !== 'aval' && method !== 'pse') return;
    if (payment.showTerms !== false && !accepted) return;

    const missing = payment.fields.some((field) => {
      if (field.kind === 'amount') return !(values[field.id] ?? '').replace(/\D/g, '');
      return !(values[field.id] ?? '').trim();
    });
    if (missing) return;

    const amountField = payment.fields.find((field) => field.kind === 'amount');
    const amount = amountField ? (values[amountField.id] ?? '').replace(/\D/g, '') : '0';
    const references = payment.fields
      .filter((field) => field.kind !== 'amount')
      .map((field) => ({
        label: 'label' in field ? field.label.replace(/\s*\*$/, '') : field.id,
        value: values[field.id] ?? '',
      }));

    const session: PasarelaSession = {
      serviceName: payment.serviceName,
      logo: payment.hideLogo ? undefined : agreement.logo,
      amount,
      references,
      detail: detailOpen ? detail : undefined,
      method: method as 'aval' | 'pse',
      backTo: `${backTo}/pagar/${id}`,
      agreementId: id,
      transactionId: createTransactionId(),
    };
    savePasarelaSession(session);
    window.clearTimeout(loaderTimer.current);
    setLoading(true);
    loaderTimer.current = window.setTimeout(() => {
      navigate('/pasarela-pagos', { state: session });
    }, 2000);
  };

  if (!payment || !agreement) {
    return <Navigate to={backTo} replace />;
  }

  return (
    <MainLayout>
      <section className="pay-view">
        {loading && <PageLoader />}
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
            {!payment.hideLogo && <img className="pay-logo" src={agreement.logo} alt={payment.serviceName} />}
          </div>

          <form className="pay-form" onSubmit={handlePay}>
            <div className="pay-name">
              <p>Servicio a pagar</p>
              <h2>{payment.serviceName}</h2>
            </div>

            {(payment.location || payment.address) && (
              <div className="pay-location">
                {payment.location && (
                  <div>
                    <strong>Ubicación:</strong> {payment.location}
                  </div>
                )}
                {payment.address && (
                  <div>
                    <strong>Dirección:</strong> {payment.address}
                  </div>
                )}
              </div>
            )}

            {payment.helpImage && (
              <div className="pay-help">
                <button
                  type="button"
                  className="pay-help__zoom-trigger"
                  onClick={() => setZoomOpen(true)}
                  aria-label="Ver imagen de ayuda en grande"
                >
                  <img className="pay-help__desktop" src={payment.helpImage} alt="Dónde encontrar tu referencia de pago" />
                </button>
                <div className="pay-help__mobile">
                  <button type="button" className="pay-help__link" onClick={() => setHelpOpen((value) => !value)}>
                    <img src={paymentAssets.helpIcon} alt="" />
                    <span>Ver imagen de ayuda</span>
                  </button>
                  {helpOpen && (
                    <button type="button" className="pay-help__preview-trigger" onClick={() => setZoomOpen(true)}>
                      <img className="pay-help__preview" src={payment.helpImage} alt="Dónde encontrar tu referencia de pago" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {zoomOpen && payment.helpImage && (
              <div className="pay-zoom" role="dialog" aria-modal="true" onClick={() => setZoomOpen(false)}>
                <div className="pay-zoom__box" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="pay-zoom__close" onClick={() => setZoomOpen(false)} aria-label="Cerrar">
                    ×
                  </button>
                  <img src={payment.helpImage} alt="Dónde encontrar tu referencia de pago" />
                </div>
              </div>
            )}

            {brebQrOpen && (
              <div className="pay-zoom" role="dialog" aria-modal="true" onClick={() => setBrebQrOpen(false)}>
                <div className="pay-zoom__box" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="pay-zoom__close" onClick={() => setBrebQrOpen(false)} aria-label="Cerrar">
                    ×
                  </button>
                  <img src={brebQr} alt="Código QR para pagar con Bre-B" />
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

              {(() => {
                const amountField = payment.fields.find((field) => field.kind === 'amount');
                if (!amountField) return null;
                const formatted = formatAmountDigits(values[amountField.id] ?? '');
                return (
                  <div className="pay-cost">
                    <p className="pay-cost__label">Valor de la transacción</p>
                    <p className="pay-cost__value">$ {formatted || '0'}</p>
                  </div>
                );
              })()}

              {payment.showDetail !== false && (
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
              )}
            </div>

            <div className="pay-methods">
              <p className="pay-methods__lead">
                {!payment.methodsLead || payment.methodsLead === 'Otros medios de pago:'
                  ? 'Selecciona el medio de pago para continuar tu transacción:'
                  : payment.methodsLead}
              </p>
              {payment.plainMethods ? (
                <div className="pay-methods__logos pay-methods__logos--plain">
                  {payment.methods.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`pay-methods__logo ${method === item.id ? 'is-selected' : ''}`}
                      title={item.title}
                      onClick={() => {
                        setMethod(item.id);
                        if (item.id === 'breb') setBrebQrOpen(true);
                      }}
                    >
                      <img src={item.logo} alt={item.title} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pay-methods__row">
                  {payment.methods
                    .filter((item) => item.id === 'breb')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`pay-methods__breb ${method === item.id ? 'is-selected' : ''}`}
                        title={item.title}
                        onClick={() => {
                          setMethod(item.id);
                          setBrebQrOpen(true);
                        }}
                      >
                        <img src={item.logo} alt={item.title} />
                      </button>
                    ))}
                  <div
                    className={`pay-methods__card ${method === 'aval' || method === 'pse' ? 'is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const other = payment.methods.find((item) => item.id === 'aval' || item.id === 'pse');
                      if (other) setMethod(other.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      const other = payment.methods.find((item) => item.id === 'aval' || item.id === 'pse');
                      if (other) setMethod(other.id);
                    }}
                  >
                    <p>Otros medios de pago:</p>
                    <div className="pay-methods__logos">
                      {payment.methods
                        .filter((item) => item.id !== 'breb')
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="pay-methods__logo"
                            title={item.title}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMethod(item.id);
                            }}
                          >
                            <img src={item.logo} alt={item.title} />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {payment.showTerms !== false && (
              <label className="pay-terms">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                <span>
                  Acepto <button type="button">términos y condiciones</button>
                </span>
              </label>
            )}

            <div className="pay-actions">
              {payment.showLogin !== false && <p>¡Agiliza tu pago si ya te encuentras registrado en nuestro portal!</p>}
              <div className="pay-actions__buttons">
                <Button variant="primary" type="submit">
                  {payment.submitLabel ?? 'Pagar'}
                </Button>
                {(payment.secondaryLabel ?? 'Agiliza tu pago') && (
                  <Button variant="primary" type="button">
                    {payment.secondaryLabel ?? 'Agiliza tu pago'}
                  </Button>
                )}
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
    const options =
      field.options?.length > 0
        ? field.options
        : /tipo de persona/i.test(field.label)
          ? ['Juridica', 'Natural']
          : [];

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
            {options.map((option) => (
              <button key={option} type="button" onClick={() => onPick(option)}>
                {option}
              </button>
            ))}
            {!options.length && (
              <p className="pay-select__empty">No hay opciones disponibles para este campo.</p>
            )}
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
        value={formatAmountDigits(value)}
        inputMode="numeric"
        symbol={amountFocused || value.length > 0}
        onFocus={onAmountFocus}
        onBlur={onAmountBlur}
        onChange={(next) => onChange(next.replace(/\D/g, '').slice(0, field.maxLength ?? 19))}
      />
    );
  }

  const isEmail = /correo|e-?mail/i.test(`${field.label} ${field.id}`);

  return (
    <FloatField
      label={field.label}
      value={value}
      maxLength={field.maxLength}
      inputMode={field.numeric ? 'numeric' : isEmail ? 'text' : 'text'}
      onChange={(next) => {
        let cleaned = next;
        if (field.numeric) cleaned = next.replace(/\D/g, '');
        else if (isEmail) cleaned = next.replace(/[^a-zA-Z0-9.@_+-]/g, '');
        else cleaned = next.replace(/[^\p{L}\p{N}\s.@_\-+#/]/gu, '');
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
