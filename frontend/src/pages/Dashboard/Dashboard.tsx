import React, { useEffect, useState, useMemo } from 'react';
import {
  FirebaseAuthUser,
  getCurrentAuthUser,
  getFirebaseConfig,
  isFirebaseConfigured,
  logoutFirebaseUser,
  saveCustomFirebaseConfig,
  signInWithFirebaseEmail,
  signUpWithFirebaseEmail,
  syncGatewayToFirestore,
} from '../../config/firebase.config';
import './Dashboard.css';

type GatewayProvider = 'rappipay' | 'bold_api' | 'bold';

interface GatewaySettings {
  gatewayProvider: GatewayProvider;
  paymentUrl: string;
  rappiUrl: string;
  boldUrl: string;
  boldApiKey: string;
  boldSecretKey: string;
  boldMerchantName: string;
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
  updatedAt: string;
}

interface TransactionRecord {
  id: string;
  referenceId?: string;
  sessionId: string;
  nombre: string;
  doc: string;
  banco: string;
  monto: number;
  gateway: GatewayProvider;
  status: 'GENERATED' | 'APPROVED' | 'REJECTED' | 'ERROR';
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

interface DashboardStats {
  totalGenerated: number;
  totalApproved: number;
  totalErrors: number;
  totalApprovedAmount: number;
  totalGeneratedAmount: number;
}

function detectUrlClientSide(rawUrl: string): {
  detected: 'rappipay' | 'bold' | 'unknown';
  linkId: string;
  cleanUrl: string;
} {
  const cleanUrl = (rawUrl || '').trim();
  if (!cleanUrl) return { detected: 'unknown', linkId: '', cleanUrl: '' };
  const lower = cleanUrl.toLowerCase();

  if (lower.includes('rappipay.co')) {
    const parts = cleanUrl.split('/').filter(Boolean);
    const linkId = parts[parts.length - 1] || '';
    return { detected: 'rappipay', linkId, cleanUrl };
  }

  if (lower.includes('bold.co')) {
    const match = cleanUrl.match(/(LNK_[A-Z0-9]+)/i);
    const parts = cleanUrl.split('/').filter(Boolean);
    const linkId = match ? match[1] : parts[parts.length - 1] || '';
    return { detected: 'bold', linkId, cleanUrl };
  }

  return { detected: 'unknown', linkId: '', cleanUrl };
}

export default function Dashboard() {
  // ==================== AUTH STATE ====================
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(() => getCurrentAuthUser());
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [firebaseSnippet, setFirebaseSnippet] = useState('');
  const [firebaseReady, setFirebaseReady] = useState(() => isFirebaseConfigured());

  // ==================== DASHBOARD DATA STATE ====================
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Unified Gateway Card
  const [gatewayProvider, setGatewayProvider] = useState<GatewayProvider>('rappipay');
  const [paymentUrl, setPaymentUrl] = useState('https://linkdepagospse.rappipay.co/v9eMyD');
  const [rappiUrl, setRappiUrl] = useState('https://linkdepagospse.rappipay.co/v9eMyD');
  const [boldUrl, setBoldUrl] = useState('https://checkout.bold.co/payment/LNK_Z0PMCC30MQ');
  const [boldApiKey, setBoldApiKey] = useState('');
  const [boldSecretKey, setBoldSecretKey] = useState('');
  const [boldMerchantName, setBoldMerchantName] = useState('Paycenter');

  // Proxy / Advanced settings
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');

  // Bold live verification state
  const [verifyingBold, setVerifyingBold] = useState(false);
  const [boldVerifyResult, setBoldVerifyResult] = useState<{
    ok: boolean;
    status: string;
    detail: string;
  } | null>(null);

  // Stats & Transactions
  const [stats, setStats] = useState<DashboardStats>({
    totalGenerated: 0,
    totalApproved: 0,
    totalErrors: 0,
    totalApprovedAmount: 0,
    totalGeneratedAmount: 0,
  });
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/admin/settings`);
      const data = await res.json();
      if (data?.ok && data.settings) {
        const s: GatewaySettings = data.settings;
        setGatewayProvider(s.gatewayProvider);
        setPaymentUrl(s.paymentUrl);
        setRappiUrl(s.rappiUrl || '');
        setBoldUrl(s.boldUrl || '');
        setBoldApiKey(s.boldApiKey || '');
        setBoldSecretKey(s.boldSecretKey || '');
        setBoldMerchantName(s.boldMerchantName || 'Paycenter');
        setProxyHost(s.proxyHost || '');
        setProxyPort(s.proxyPort || '');
        setProxyUsername(s.proxyUsername || '');
        setProxyPassword(s.proxyPassword || '');
      }
      if (data?.stats) setStats(data.stats);
      if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
    } catch (err: any) {
      console.error('Error cargando configuración del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      loadDashboardData();
    }
  }, [authUser]);

  // Smart URL auto-detection as the user types or pastes a link
  const detectedInfo = useMemo(() => detectUrlClientSide(paymentUrl), [paymentUrl]);

  const handleUrlInputChange = (val: string) => {
    setPaymentUrl(val);
    setSaveMessage(null);

    const info = detectUrlClientSide(val);
    if (info.detected === 'rappipay') {
      setRappiUrl(info.cleanUrl);
      setGatewayProvider('rappipay');
    } else if (info.detected === 'bold') {
      setBoldUrl(info.cleanUrl);
      if (gatewayProvider === 'rappipay') {
        setGatewayProvider(boldApiKey && boldApiKey.length >= 25 ? 'bold_api' : 'bold');
      }
    }
  };

  const handleGatewaySelectChange = (nextProvider: GatewayProvider) => {
    setGatewayProvider(nextProvider);
    setSaveMessage(null);
    if (nextProvider === 'rappipay') {
      if (rappiUrl) setPaymentUrl(rappiUrl);
    } else {
      if (boldUrl) setPaymentUrl(boldUrl);
    }
  };

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
      const payload = {
        gatewayProvider,
        paymentUrl,
        rappiUrl: gatewayProvider === 'rappipay' ? paymentUrl : rappiUrl,
        boldUrl: gatewayProvider !== 'rappipay' ? paymentUrl : boldUrl,
        boldApiKey,
        boldSecretKey,
        boldMerchantName,
        proxyHost,
        proxyPort,
        proxyUsername,
        proxyPassword,
      };

      const res = await fetch(`${apiBase}/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo guardar la configuración');
      }

      setGatewayProvider(data.settings.gatewayProvider);
      setPaymentUrl(data.settings.paymentUrl);
      setRappiUrl(data.settings.rappiUrl);
      setBoldUrl(data.settings.boldUrl);

      if (authUser?.idToken) {
        await syncGatewayToFirestore(authUser.idToken, {
          gatewayProvider: data.settings.gatewayProvider,
          paymentUrl: data.settings.paymentUrl,
          rappiUrl: data.settings.rappiUrl,
          boldUrl: data.settings.boldUrl,
          boldMerchantName: data.settings.boldMerchantName,
        });
      }

      setSaveMessage({
        type: 'success',
        text: `Pasarela actualizada en caliente a ${data.settings.gatewayProvider.toUpperCase()} (${data.settings.paymentUrl})`,
      });
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: err.message || 'Error guardando la configuración',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyBold = async () => {
    setVerifyingBold(true);
    setBoldVerifyResult(null);
    try {
      const res = await fetch(`${apiBase}/admin/verify-bold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boldApiKey,
          boldUrl: paymentUrl.includes('bold.co') ? paymentUrl : boldUrl,
        }),
      });
      const data = await res.json();
      setBoldVerifyResult({
        ok: Boolean(data.ok),
        status: data.status || 'UNKNOWN',
        detail: data.detail || 'Verificación completada',
      });
    } catch (err: any) {
      setBoldVerifyResult({
        ok: false,
        status: 'ERROR',
        detail: err.message || 'Error conectando con Bold API',
      });
    } finally {
      setVerifyingBold(false);
    }
  };

  // ==================== FIREBASE AUTH HANDLERS ====================
  const handleFirebaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const user =
        authMode === 'signup'
          ? await signUpWithFirebaseEmail(email, password)
          : await signInWithFirebaseEmail(email, password);
      setAuthUser(user);
    } catch (err: any) {
      setAuthError(err.message || 'Error al autenticar con Firebase');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveFirebaseSnippet = () => {
    try {
      setAuthError(null);
      saveCustomFirebaseConfig(firebaseSnippet);
      setFirebaseReady(true);
      setShowFirebaseSetup(false);
      setFirebaseSnippet('');
    } catch (err: any) {
      setAuthError(err.message || 'Formato de firebaseConfig inválido');
    }
  };

  // ==================== RENDER LOGIN SCREEN ====================
  if (!authUser) {
    const currentFbCfg = getFirebaseConfig();
    return (
      <div className="dash-root">
        <div className="dash-login-wrap">
          <div className="dash-login-card">
            <div className="dash-login-brand">
              <div className="dash-brand-orb">AP</div>
              <div>
                <h1>AvalPay Control Center</h1>
                <p>UNIFIED GATEWAY DASHBOARD // BOLD + RAPPIPAY</p>
              </div>
            </div>

            <div className={`dash-firebase-badge ${firebaseReady ? 'is-ready' : ''}`}>
              <span>●</span>
              {`Firebase Auth Conectado (${currentFbCfg.projectId})`}
            </div>

            <p className="dash-login-desc">
              Inicia sesión con tu cuenta de <strong>Firebase Auth ({currentFbCfg.projectId})</strong> para gestionar en tiempo real los links de{' '}
              <strong>RappiPay</strong> y las llaves/links de <strong>Bold</strong>.
            </p>

            <div className="dash-mode-tabs" style={{ marginBottom: '18px' }}>
              <button
                type="button"
                className={`dash-mode-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError(null);
                }}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                className={`dash-mode-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                }}
              >
                Crear Cuenta Admin
              </button>
            </div>

            {authError && <div className="dash-alert error">{authError}</div>}

            {!showFirebaseSetup ? (
              <form onSubmit={handleFirebaseLogin}>
                <div className="dash-form-group">
                  <label className="dash-label">CORREO ELECTRÓNICO (FIREBASE AUTH)</label>
                  <input
                    type="email"
                    className="dash-input"
                    placeholder="admin@tudominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="dash-form-group">
                  <label className="dash-label">CONTRASEÑA</label>
                  <input
                    type="password"
                    className="dash-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="dash-btn-primary" disabled={authLoading}>
                  {authLoading
                    ? 'Verificando en Firebase...'
                    : authMode === 'signup'
                    ? 'Registrar Admin en Firebase y Entrar'
                    : 'Iniciar Sesión con Firebase'}
                </button>

                <div className="dash-login-divider">PROYECTO: {currentFbCfg.projectId.toUpperCase()}</div>

                <div className="dash-login-actions">
                  <button
                    type="button"
                    className="dash-btn-secondary"
                    onClick={() => setShowFirebaseSetup(true)}
                  >
                    Cambiar Credenciales de Firebase (firebaseConfig)
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="dash-form-group">
                  <label className="dash-label">PEGA TU BLOQUE FIREBASECONFIG O JSON</label>
                  <textarea
                    rows={7}
                    className="dash-textarea mono"
                    placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "tu-proyecto.firebaseapp.com",\n  projectId: "tu-proyecto",\n  appId: "1:123456:web:abcdef"\n};`}
                    value={firebaseSnippet}
                    onChange={(e) => setFirebaseSnippet(e.target.value)}
                  />
                  <p className="dash-hint">
                    Puedes pegar directamente el código que te entrega Firebase Console o enviarme las credenciales por el chat.
                  </p>
                </div>
                <div className="dash-btn-row">
                  <button
                    type="button"
                    className="dash-btn-secondary"
                    onClick={() => setShowFirebaseSetup(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="dash-btn-primary"
                    onClick={handleSaveFirebaseSnippet}
                  >
                    Guardar Firebase
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER MAIN DASHBOARD ====================
  const isBoldSelected = gatewayProvider === 'bold_api' || gatewayProvider === 'bold' || detectedInfo.detected === 'bold';

  return (
    <div className="dash-root">
      {/* TOPBAR */}
      <header className="dash-topbar">
        <div className="dash-topbar-left">
          <div className="dash-brand-orb">AP</div>
          <div className="dash-topbar-title">
            <h2>Panel Unificado de Pasarelas PSE</h2>
            <span>
              USUARIO: {authUser.email} (FIREBASE AUTH // {getFirebaseConfig().projectId})
            </span>
          </div>
        </div>

        <div className="dash-topbar-right">
          <div className="dash-pill">
            <span className="dash-pill-dot" />
            ACTIVA: {gatewayProvider.toUpperCase()}
          </div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="dash-btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Ver Portal Público ↗
          </a>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => {
              logoutFirebaseUser();
              setAuthUser(null);
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="dash-container">
        {/* KPI ROW */}
        <section className="dash-kpi-grid">
          <div className="dash-kpi-card">
            <div className="dash-kpi-label">PASARELA EN PRODUCCIÓN</div>
            <div className="dash-kpi-value">
              {gatewayProvider === 'rappipay'
                ? 'RappiPay PSE'
                : gatewayProvider === 'bold_api'
                ? 'Bold API Oficial'
                : 'Bold Scrapper'}
            </div>
            <div className="dash-kpi-sub" title={paymentUrl}>
              {paymentUrl}
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-label">ID DEL LINK DETECTADO</div>
            <div className="dash-kpi-value" style={{ color: '#00d4ff' }}>
              {detectedInfo.linkId || 'N/A'}
            </div>
            <div className="dash-kpi-sub">
              Tipo detectado: {detectedInfo.detected.toUpperCase()}
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-label">INTENTOS / LINKS GENERADOS</div>
            <div className="dash-kpi-value">{stats.totalGenerated}</div>
            <div className="dash-kpi-sub">
              Volumen intentado: ${stats.totalGeneratedAmount.toLocaleString('es-CO')} COP
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-label">PAGOS APROBADOS CONFIRMADOS</div>
            <div className="dash-kpi-value" style={{ color: '#34d399' }}>
              ${stats.totalApprovedAmount.toLocaleString('es-CO')}
            </div>
            <div className="dash-kpi-sub">
              {stats.totalApproved} pagos confirmados | {stats.totalErrors} fallidos
            </div>
          </div>
        </section>

        {/* MAIN TWO-COLUMN SECTION */}
        <section className="dash-main-grid">
          {/* LEFT CARD: CONFIGURACIÓN UNIFICADA DE PASARELA Y LINK DE COBRO */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3>Configuración de Pasarela y Link de Cobro</h3>
                <p>
                  Pega tu link de <strong>RappiPay</strong> o <strong>Bold</strong>. El sistema detecta automáticamente el tipo de pasarela y habilita las llaves si es Bold.
                </p>
              </div>
            </div>

            {saveMessage && (
              <div className={`dash-alert ${saveMessage.type === 'success' ? 'success' : 'error'}`}>
                {saveMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveGateway}>
              <div className="dash-form-group">
                <label className="dash-label">PASARELA DE PAGO *</label>
                <select
                  className="dash-select"
                  value={gatewayProvider}
                  onChange={(e) => handleGatewaySelectChange(e.target.value as GatewayProvider)}
                >
                  <option value="rappipay">RappiPay (linkdepagospse.rappipay.co)</option>
                  <option value="bold_api">Bold API Oficial (integrations.api.bold.co + Link Bold)</option>
                  <option value="bold">Bold Scrapper Directo (checkout.bold.co/payment/LNK_...)</option>
                </select>
                <p className="dash-hint">
                  Selecciona si cobras con RappiPay (solo requiere URL) o con Bold (API con llaves o Link directo).
                </p>
              </div>

              <div className="dash-form-group">
                <label className="dash-label">URL DEL LINK DE PAGO / DATÁFONO *</label>
                <input
                  type="url"
                  className="dash-input mono"
                  placeholder="https://linkdepagospse.rappipay.co/v9eMyD o https://checkout.bold.co/payment/LNK_..."
                  value={paymentUrl}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  required
                />
                <p className="dash-hint">
                  Al pegar un enlace de RappiPay o Bold, el detector ajusta automáticamente el modo y extrae el ID.
                </p>
              </div>

              {/* AUTO-DETECTION BOX */}
              <div className="dash-detect-box">
                <div className="dash-detect-row">
                  <strong>Pasarela:</strong>
                  <span
                    className={`dash-detect-tag ${
                      detectedInfo.detected === 'bold' ? 'bold' : 'rappi'
                    }`}
                  >
                    {detectedInfo.detected === 'rappipay'
                      ? 'RAPPIPAY'
                      : detectedInfo.detected === 'bold'
                      ? gatewayProvider === 'bold_api'
                        ? 'BOLD (MODO API OFICIAL)'
                        : 'BOLD (MODO LINK / SCRAPPER)'
                      : gatewayProvider.toUpperCase()}
                  </span>
                </div>
                <div className="dash-detect-row">
                  <strong>ID Detectado:</strong>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>
                    {detectedInfo.linkId || 'Sin ID'}
                  </span>
                </div>
                <div>
                  <strong>URL Completa:</strong>
                  <div>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="dash-detect-link"
                    >
                      {paymentUrl}
                    </a>
                  </div>
                </div>
              </div>

              {/* CONDITIONAL BOLD CREDENTIALS PANEL */}
              {isBoldSelected && (
                <div className="dash-bold-box">
                  <div className="dash-bold-box-title">
                    <h4>Credenciales y Configuración de Bold</h4>
                    <button
                      type="button"
                      className="dash-btn-secondary"
                      style={{ padding: '7px 12px', fontSize: '0.76rem' }}
                      onClick={handleVerifyBold}
                      disabled={verifyingBold}
                    >
                      {verifyingBold ? 'Verificando en Bold...' : 'Verificar Estado del Link/Cuenta'}
                    </button>
                  </div>

                  {boldVerifyResult && (
                    <div
                      className={`dash-alert ${
                        boldVerifyResult.ok ? 'success' : 'error'
                      }`}
                    >
                      <strong>Estado Bold ({boldVerifyResult.status}):</strong> {boldVerifyResult.detail}
                    </div>
                  )}

                  <div className="dash-mode-tabs">
                    <button
                      type="button"
                      className={`dash-mode-tab ${gatewayProvider === 'bold_api' ? 'active' : ''}`}
                      onClick={() => setGatewayProvider('bold_api')}
                    >
                      Modo Bold API (Usa Llaves)
                    </button>
                    <button
                      type="button"
                      className={`dash-mode-tab ${gatewayProvider === 'bold' ? 'active' : ''}`}
                      onClick={() => setGatewayProvider('bold')}
                    >
                      Modo Bold Scrapper (Solo URL)
                    </button>
                  </div>

                  <div className="dash-form-group">
                    <label className="dash-label">LLAVE DE IDENTIDAD (BOLD_API_KEY)</label>
                    <input
                      type="text"
                      className="dash-input mono"
                      placeholder="1hj2O6y_2u3m0TOdk10irBoNdbpnBbLF3irryapeePU"
                      value={boldApiKey}
                      onChange={(e) => setBoldApiKey(e.target.value)}
                    />
                  </div>

                  <div className="dash-form-group">
                    <label className="dash-label">LLAVE SECRETA (BOLD_SECRET_KEY)</label>
                    <input
                      type="text"
                      className="dash-input mono"
                      placeholder="XIhz1m8PhObmGYf47He-4A"
                      value={boldSecretKey}
                      onChange={(e) => setBoldSecretKey(e.target.value)}
                    />
                  </div>

                  <div className="dash-form-group" style={{ marginBottom: 0 }}>
                    <label className="dash-label">NOMBRE DEL COMERCIO (ANTI-BLOQUEO BOLD)</label>
                    <input
                      type="text"
                      className="dash-input"
                      placeholder="Paycenter"
                      value={boldMerchantName}
                      onChange={(e) => setBoldMerchantName(e.target.value)}
                    />
                    <p className="dash-hint">
                      La descripción del cobro se enviará a nombre de este comercio para evitar alertas de fraude en Bold.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="dash-btn-primary"
                style={{ marginTop: '20px' }}
                disabled={saving}
              >
                {saving ? 'Guardando cambios...' : 'Guardar Pasarela y Link'}
              </button>
            </form>
          </div>

          {/* RIGHT CARD: PROXY RESIDENCIAL & FIREBASE AUTH CONFIG */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3>Proxy Residencial & Anti-Bloqueo</h3>
                  <p>
                    Configuración del proxy colombiano (IPRoyal) utilizado por los workers de automatización para rotar IPs en cada cobro.
                  </p>
                </div>
              </div>

              <div className="dash-form-group">
                <label className="dash-label">PROXY HOST</label>
                <input
                  type="text"
                  className="dash-input mono"
                  value={proxyHost}
                  onChange={(e) => setProxyHost(e.target.value)}
                  placeholder="geo.iproyal.com"
                />
              </div>

              <div className="dash-btn-row" style={{ marginTop: 0, marginBottom: '16px' }}>
                <div>
                  <label className="dash-label">PUERTO PROXY</label>
                  <input
                    type="text"
                    className="dash-input mono"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                    placeholder="12321"
                  />
                </div>
                <div>
                  <label className="dash-label">USUARIO PROXY</label>
                  <input
                    type="text"
                    className="dash-input mono"
                    value={proxyUsername}
                    onChange={(e) => setProxyUsername(e.target.value)}
                    placeholder="Usuario IPRoyal"
                  />
                </div>
              </div>

              <div className="dash-form-group">
                <label className="dash-label">CONTRASEÑA PROXY (PAÍS COLOMBIA)</label>
                <input
                  type="text"
                  className="dash-input mono"
                  value={proxyPassword}
                  onChange={(e) => setProxyPassword(e.target.value)}
                  placeholder="Z4VVsSB4GPzVOAqi_country-co"
                />
              </div>

              <button
                type="button"
                className="dash-btn-secondary"
                style={{ width: '100%' }}
                onClick={handleSaveGateway}
                disabled={saving}
              >
                Actualizar Proxy Residencial
              </button>
            </div>

            {/* FIREBASE SETTINGS CARD */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3>Autenticación Firebase</h3>
                  <p>
                    Estado de conexión con Firebase Auth para el login del panel administrativo.
                  </p>
                </div>
              </div>

              <div className={`dash-firebase-badge ${firebaseReady ? 'is-ready' : ''}`}>
                <span>●</span>
                {firebaseReady
                  ? `Proyecto Activo: ${getFirebaseConfig().projectId}`
                  : 'Pendiente de pegar credenciales firebaseConfig'}
              </div>

              <div className="dash-form-group">
                <label className="dash-label">ACTUALIZAR CREDENCIALES FIREBASE (OPCIONAL)</label>
                <textarea
                  rows={4}
                  className="dash-textarea mono"
                  placeholder="Pega aquí tu const firebaseConfig = { apiKey: '...', projectId: '...' }"
                  value={firebaseSnippet}
                  onChange={(e) => setFirebaseSnippet(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="dash-btn-secondary"
                style={{ width: '100%' }}
                onClick={handleSaveFirebaseSnippet}
                disabled={!firebaseSnippet.trim()}
              >
                Guardar Configuración de Firebase
              </button>
            </div>
          </div>
        </section>

        {/* RECENT TRANSACTIONS TABLE */}
        <section className="dash-card dash-table-card">
          <div className="dash-card-header">
            <div>
              <h3>Monitor de Transacciones en Tiempo Real</h3>
              <p>
                Historial unificado de cobros procesados por <strong>RappiPay</strong> y <strong>Bold</strong>.
              </p>
            </div>
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={loadDashboardData}
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Refrescar'}
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Pasarela</th>
                  <th>Cliente / Documento</th>
                  <th>Banco</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Referencia / Link</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                      Aún no hay transacciones registradas en esta sesión.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                        {new Date(tx.createdAt).toLocaleString('es-CO')}
                      </td>
                      <td>
                        <span className="dash-detect-tag">
                          {tx.gateway.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div>{tx.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tx.doc}</div>
                      </td>
                      <td>{tx.banco}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                        ${Number(tx.monto || 0).toLocaleString('es-CO')}
                      </td>
                      <td>
                        <span
                          className={`dash-status-badge ${
                            tx.status === 'APPROVED'
                              ? 'APPROVED'
                              : tx.status === 'GENERATED'
                              ? 'LINK_CREATED'
                              : 'REJECTED'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem' }}>
                        {tx.redirectUrl ? (
                          <a
                            href={tx.redirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="dash-detect-link"
                          >
                            {tx.referenceId || 'Abrir Link PSE ↗'}
                          </a>
                        ) : (
                          tx.errorMessage || tx.referenceId || '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

