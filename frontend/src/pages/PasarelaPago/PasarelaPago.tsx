import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  clearPasarelaSession,
  formatPasarelaMoney,
  loadPasarelaSession,
  pasarelaAssets,
  pasarelaAvalBanks,
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
  const [personType, setPersonType] = useState('');
  const [docOpen, setDocOpen] = useState(false);
  const [clientDocOpen, setClientDocOpen] = useState(false);
  const [pseBankOpen, setPseBankOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = 'PasarelaPagos';
  }, []);

  const amountLabel = useMemo(
    () => (session ? formatPasarelaMoney(session.amount) : '$ 0'),
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
  };

  const onCancel = () => {
    clearPasarelaSession();
    navigate(session.backTo);
  };

  return (
    <div className="pasarela">
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
              <p>{session.serviceName}</p>
              {session.detail && <p>{session.detail}</p>}
            </div>

            <div className="pasarela-product__client">
              <div className="pasarela-product__row">
                <p>ID Transacción:</p>
                <p>{session.transactionId}</p>
              </div>
              <div className="pasarela-product__row">
                <p>Referencia:</p>
                <p>
                  {session.references.map((item) => item.value).filter(Boolean).join(' / ') ||
                    session.agreementId}
                </p>
              </div>
            </div>

            <div className="pasarela-product__details">
              <div className="pasarela-product__row">
                <p>Valor:</p>
                <p className="pasarela-product__price">{amountLabel}</p>
              </div>
              {session.references.map((item) => (
                <div className="pasarela-product__row" key={item.label}>
                  <p>{item.label}:</p>
                  <p>{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {submitted ? (
          <section className="pasarela-done white-form">
            <p className="pasarela-done__title">Transacción en proceso</p>
            <p>
              Estimado cliente, tu pago con{' '}
              {payMethod === 'aval' ? 'Bancos Aval' : 'PSE'} quedó registrado por {amountLabel}. En un
              entorno real continuarías en el banco seleccionado.
            </p>
            <button type="button" className="pasarela-btn pasarela-btn--primary" onClick={onCancel}>
              Volver
            </button>
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
                  onToggle={() => setDocOpen((v) => !v)}
                  onPick={(value) => {
                    setDocType(value);
                    setDocOpen(false);
                  }}
                />
                <FieldInput
                  label="Número de documento *"
                  value={docNumber}
                  placeholder="Ingresa tu documento"
                  error={errors.docNumber}
                  onChange={setDocNumber}
                />
                <FieldInput
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
                <p>Selecciona el medio de pago a utilizar</p>
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
                  <span>
                    Bancos Aval
                    <small>(Banca Personal)</small>
                  </span>
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
                  <span>PSE</span>
                </button>
              </div>

              {payMethod === 'aval' && (
                <div className="pasarela-aval">
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
                  <FieldSelect
                    label="Tipo de persona *"
                    value={pasarelaPersonTypes.find((item) => item.id === personType)?.label ?? ''}
                    open={personOpen}
                    options={pasarelaPersonTypes.map((item) => item.label)}
                    placeholder="Seleccione el tipo de persona"
                    onToggle={() => setPersonOpen((v) => !v)}
                    onPick={(label) => {
                      const found = pasarelaPersonTypes.find((item) => item.label === label);
                      setPersonType(found?.id ?? '');
                      setPersonOpen(false);
                    }}
                    error={errors.personType}
                  />
                  <FieldSelect
                    label="Banco *"
                    value={pseBank}
                    open={pseBankOpen}
                    options={pasarelaPseBanks}
                    placeholder="Seleccione un Banco"
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
}

function FieldInput({ label, value, onChange, placeholder, type = 'text', maxLength, error }: FieldInputProps) {
  return (
    <div className="pasarela-field">
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
}: FieldSelectProps) {
  return (
    <div className="pasarela-field">
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
