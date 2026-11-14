import React, { useEffect, useState, useMemo } from 'react';
import {
  FirebaseAuthUser,
  getCurrentAuthUser,
  getFirebaseConfig,
  logoutFirebaseUser,
  loginWithPasswordOnly,
  createUserByAdmin,
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

interface PanelUserRecord {
  id: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt?: string;
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
  // ==================== THEME & VIEW STATE ====================
  const [theme, setTheme] = useState<'editorial' | 'obsidian'>(() => {
    return (localStorage.getItem('avalpay_dash_theme') as 'editorial' | 'obsidian') || 'editorial';
  });
  const [activeTab, setActiveTab] = useState<'all' | 'gateways' | 'transactions' | 'users'>('all');

  const toggleTheme = () => {
    const next = theme === 'editorial' ? 'obsidian' : 'editorial';
    setTheme(next);
    localStorage.setItem('avalpay_dash_theme', next);
  };

  // ==================== AUTH STATE (PASSWORD ONLY) ====================
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(() => getCurrentAuthUser());
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Admin User Management States (Only for Cuenta Admin)
  const [usersList, setUsersList] = useState<PanelUserRecord[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [userActionMsg, setUserActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

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

      if (authUser?.role === 'admin') {
        const uRes = await fetch(`${apiBase}/admin/users`);
        const uData = await uRes.json();
        if (uData?.ok && Array.isArray(uData.users)) {
          setUsersList(uData.users);
        }
      }
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
          updatedBy: authUser.name,
        });
      }

      setSaveMessage({
        type: 'success',
        text: `Pasarela activa sincronizada a ${data.settings.gatewayProvider.toUpperCase()} (${data.settings.paymentUrl})`,
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

  // ==================== PASSWORD-ONLY LOGIN HANDLER ====================
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const user = await loginWithPasswordOnly(password, apiBase);
      setAuthUser(user);
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Contraseña de acceso inválida.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ==================== ADMIN USER MANAGEMENT HANDLERS ====================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionMsg(null);
    setCreatingUser(true);
    try {
      const res = await createUserByAdmin({
        name: newUserName,
        password: newUserPassword,
        role: newUserRole,
        apiBase,
        adminIdToken: authUser?.idToken,
      });
      if (Array.isArray(res.users)) {
        setUsersList(res.users);
      }
      setUserActionMsg({
        type: 'success',
        text: `Acceso creado para "${newUserName}" con clave: ${newUserPassword}`,
      });
      setNewUserName('');
      setNewUserPassword('');
    } catch (err: any) {
      setUserActionMsg({
        type: 'error',
        text: err.message || 'No se pudo crear el usuario',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserPassword = async (u: PanelUserRecord) => {
    const nextPass = window.prompt(`Nueva contraseña para "${u.name}":`, u.password);
    if (!nextPass || nextPass.trim() === u.password) return;
    setUserActionMsg(null);
    try {
      const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPass.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error cambiando la contraseña');
      }
      setUsersList(data.users);
      setUserActionMsg({
        type: 'success',
        text: `Contraseña de "${u.name}" actualizada a: ${nextPass.trim()}`,
      });
    } catch (err: any) {
      setUserActionMsg({
        type: 'error',
        text: err.message || 'Error al actualizar contraseña',
      });
    }
  };

  const handleDeleteUser = async (u: PanelUserRecord) => {
    if (!window.confirm(`¿Revocar el acceso y eliminar al usuario "${u.name}"?`)) return;
    setUserActionMsg(null);
    try {
      const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error eliminando usuario');
      }
      setUsersList(data.users);
      setUserActionMsg({
        type: 'success',
        text: `Acceso de "${u.name}" revocado.`,
      });
    } catch (err: any) {
      setUserActionMsg({
        type: 'error',
        text: err.message || 'Error al eliminar usuario',
      });
    }
  };

  // ==================== RENDER VAULT LOGIN VIEW ====================
  if (!authUser) {
    const currentFbCfg = getFirebaseConfig();
    return (
      <div className={`dash-root ${theme === 'obsidian' ? 'theme-obsidian' : ''}`}>
        <div className="vault-wrap">
          {/* LEFT EDITORIAL SHOWCASE */}
          <aside className="vault-showcase">
            <div className="vault-showcase-top">
              <div className="vault-monogram">
                <div className="vault-crest">A</div>
                <span className="vault-monogram-text">AvalPay Private Suite</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#8a847c' }}>
                v3.4 // {currentFbCfg.projectId}
              </span>
            </div>

            <div className="vault-hero-quote">
              <div className="vault-hero-tag">
                <span>✦</span> Orquestador Ejecutivo de Pasarelas
              </div>
              <h1>Control unificado para cobros en tiempo real.</h1>
              <p>
                Conmutación instantánea entre enlaces de <strong>RappiPay PSE</strong> y credenciales de{' '}
                <strong>Bold API Oficial</strong> con rotación residencial colombiana y respaldo en Firebase.
              </p>
            </div>

            <div className="vault-feature-pills">
              <div className="vault-feature-item">
                <strong>Auto-Detector Inteligente</strong>
                <span>Reconoce links de RappiPay y Bold al pegarlos.</span>
              </div>
              <div className="vault-feature-item">
                <strong>Rotación Residencial</strong>
                <span>Sesiones limpias IPRoyal Colombia por cada cobro.</span>
              </div>
              <div className="vault-feature-item">
                <strong>Acceso por Llave</strong>
                <span>Credenciales administradas únicamente por el Admin.</span>
              </div>
            </div>
          </aside>

          {/* RIGHT VAULT AUTH PANE */}
          <section className="vault-auth-pane">
            <div style={{ position: 'absolute', top: '24px', right: '28px' }}>
              <button type="button" className="atelier-icon-btn" onClick={toggleTheme}>
                {theme === 'editorial' ? '☾ Modo Obsidiana' : '☀ Modo Marfil'}
              </button>
            </div>

            <div className="vault-card">
              <div className="vault-card-header">
                <div className="vault-status-chip">
                  <span className="vault-status-dot" />
                  Bóveda Firebase Conectada ({currentFbCfg.projectId})
                </div>
                <h2>Acceso con Llave</h2>
                <p>
                  Introduce la contraseña asignada por el Administrador para desbloquear el centro de operaciones.
                </p>
              </div>

              {authError && <div className="dash-alert error">{authError}</div>}

              <form onSubmit={handlePasswordLogin}>
                <label className="dash-label">CONTRASEÑA DE ACCESO</label>
                <div className="vault-pass-box">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="vault-pass-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="vault-eye-btn"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
                <p className="dash-hint">
                  Los operadores no pueden registrarse por su cuenta; solicita tu clave al Administrador.
                </p>

                <button type="submit" className="vault-submit-btn" disabled={authLoading}>
                  <span>{authLoading ? 'Verificando credencial...' : 'Desbloquear Panel'}</span>
                  <span>→</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ==================== RENDER MAIN DASHBOARD ====================
  const isBoldSelected = gatewayProvider === 'bold_api' || gatewayProvider === 'bold' || detectedInfo.detected === 'bold';
  const isAdmin = authUser.role === 'admin';

  return (
    <div className={`dash-root ${theme === 'obsidian' ? 'theme-obsidian' : ''}`}>
      {/* TOP NAVIGATION BAR */}
      <header className="atelier-nav">
        <div className="atelier-nav-inner">
          <div className="atelier-brand">
            <div className="atelier-logo">A</div>
            <div className="atelier-brand-title">
              <h1>AvalPay Private Suite</h1>
              <span>
                {authUser.name.toUpperCase()} · {isAdmin ? 'CUENTA ADMIN' : 'OPERADOR'}
              </span>
            </div>
          </div>

          <nav className="atelier-tabs">
            <button
              type="button"
              className={`atelier-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Vista General
            </button>
            <button
              type="button"
              className={`atelier-tab ${activeTab === 'gateways' ? 'active' : ''}`}
              onClick={() => setActiveTab('gateways')}
            >
              Pasarelas & Links
            </button>
            <button
              type="button"
              className={`atelier-tab ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transacciones ({transactions.length})
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`atelier-tab ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Usuarios ({usersList.length})
              </button>
            )}
          </nav>

          <div className="atelier-actions">
            <div className="atelier-live-pill">
              <span className="atelier-live-dot" />
              {gatewayProvider === 'rappipay'
                ? 'RAPPIPAY ACTIVO'
                : gatewayProvider === 'bold_api'
                ? 'BOLD API ACTIVO'
                : 'BOLD LINK ACTIVO'}
            </div>

            <button type="button" className="atelier-icon-btn" onClick={toggleTheme}>
              {theme === 'editorial' ? '☾ Obsidiana' : '☀ Marfil'}
            </button>

            <a href="/" target="_blank" rel="noreferrer" className="atelier-icon-btn">
              Portal Público ↗
            </a>

            <button
              type="button"
              className="atelier-icon-btn"
              onClick={() => {
                logoutFirebaseUser();
                setAuthUser(null);
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="atelier-Shell">
        {/* BENTO METRICS */}
        <section className="atelier-bento-metrics">
          <div className="atelier-metric-card featured">
            <div className="atelier-metric-top">
              <span>MOTOR DE COBRO EN VIVO</span>
              <span>● ONLINE</span>
            </div>
            <div className="atelier-metric-val">
              {gatewayProvider === 'rappipay'
                ? 'RappiPay PSE'
                : gatewayProvider === 'bold_api'
                ? 'Bold API Oficial'
                : 'Bold Checkout'}
            </div>
            <div className="atelier-metric-foot" title={paymentUrl}>
              {paymentUrl}
            </div>
          </div>

          <div className="atelier-metric-card">
            <div className="atelier-metric-top">
              <span>IDENTIFICADOR EXTRAÍDO</span>
              <span>{detectedInfo.detected.toUpperCase()}</span>
            </div>
            <div className="atelier-metric-val">{detectedInfo.linkId || '—'}</div>
            <div className="atelier-metric-foot">Detectado automáticamente del enlace</div>
          </div>

          <div className="atelier-metric-card">
            <div className="atelier-metric-top">
              <span>COBROS GENERADOS</span>
              <span>SESIÓN</span>
            </div>
            <div className="atelier-metric-val">{stats.totalGenerated}</div>
            <div className="atelier-metric-foot">
              Volumen: ${stats.totalGeneratedAmount.toLocaleString('es-CO')} COP
            </div>
          </div>

          <div className="atelier-metric-card">
            <div className="atelier-metric-top">
              <span>RECAUDO CONFIRMADO</span>
              <span style={{ color: 'var(--accent-emerald)' }}>{stats.totalApproved} APROBADOS</span>
            </div>
            <div className="atelier-metric-val" style={{ color: 'var(--accent-emerald)' }}>
              ${stats.totalApprovedAmount.toLocaleString('es-CO')}
            </div>
            <div className="atelier-metric-foot">{stats.totalErrors} intentos rechazados o con error</div>
          </div>
        </section>

        {/* MAIN WORKSPACE */}
        {(activeTab === 'all' || activeTab === 'gateways' || activeTab === 'users') && (
          <section className="atelier-grid">
            {/* LEFT PANEL: UNIFIED GATEWAY ORCHESTRATOR */}
            <div className="atelier-panel">
              <div className="atelier-panel-head">
                <div>
                  <h3>Orquestador de Pasarela y Enlace PSE</h3>
                  <p>
                    Selecciona una tarjeta o pega directamente el link de cobro. Si es <strong>RappiPay</strong> solo requiere la URL; si es <strong>Bold</strong> despliega la bóveda de llaves.
                  </p>
                </div>
              </div>

              {saveMessage && (
                <div className={`dash-alert ${saveMessage.type === 'success' ? 'success' : 'error'}`}>
                  {saveMessage.text}
                </div>
              )}

              <form onSubmit={handleSaveGateway}>
                <label className="dash-label">1. SELECCIONA EL MOTOR DE PASARELA</label>
                <div className="gateway-tiles">
                  <button
                    type="button"
                    className={`gateway-tile rappi ${gatewayProvider === 'rappipay' ? 'selected' : ''}`}
                    onClick={() => handleGatewaySelectChange('rappipay')}
                  >
                    <div className="gateway-tile-top">
                      <span className="gateway-brand-pill rappi">RAPPIPAY</span>
                      <span className="gateway-radio" />
                    </div>
                    <h4>RappiPay PSE</h4>
                    <span>Solo requiere URL del link (`rappipay.co`).</span>
                  </button>

                  <button
                    type="button"
                    className={`gateway-tile bold ${gatewayProvider === 'bold_api' ? 'selected' : ''}`}
                    onClick={() => handleGatewaySelectChange('bold_api')}
                  >
                    <div className="gateway-tile-top">
                      <span className="gateway-brand-pill bold">BOLD API</span>
                      <span className="gateway-radio" />
                    </div>
                    <h4>Bold API Oficial</h4>
                    <span>Genera links únicos por API usando tus llaves.</span>
                  </button>

                  <button
                    type="button"
                    className={`gateway-tile bold ${gatewayProvider === 'bold' ? 'selected' : ''}`}
                    onClick={() => handleGatewaySelectChange('bold')}
                  >
                    <div className="gateway-tile-top">
                      <span className="gateway-brand-pill bold">BOLD LINK</span>
                      <span className="gateway-radio" />
                    </div>
                    <h4>Bold Scrapper</h4>
                    <span>Usa un link directo (`checkout.bold.co/payment/LNK_`).</span>
                  </button>
                </div>

                {/* SMART URL INSPECTOR */}
                <div className="url-inspector-box">
                  <div className="url-inspector-top">
                    <label className="dash-label" style={{ marginBottom: 0 }}>
                      2. ENLACE DE COBRO / DATÁFONO ACTIVO *
                    </label>
                    <span
                      className={`url-detected-ribbon ${
                        detectedInfo.detected === 'bold' ? 'bold' : 'rappi'
                      }`}
                    >
                      ● DETECTADO:{' '}
                      {detectedInfo.detected === 'rappipay'
                        ? 'RAPPIPAY PSE'
                        : detectedInfo.detected === 'bold'
                        ? 'BOLD CHECKOUT'
                        : gatewayProvider.toUpperCase()}
                    </span>
                  </div>

                  <input
                    type="url"
                    className="dash-input mono"
                    placeholder="https://linkdepagospse.rappipay.co/v9eMyD o https://checkout.bold.co/payment/LNK_..."
                    value={paymentUrl}
                    onChange={(e) => handleUrlInputChange(e.target.value)}
                    required
                  />

                  <div className="url-meta-strip">
                    <div>
                      ID Extraído: <span className="url-id-chip">{detectedInfo.linkId || 'Sin ID'}</span>
                    </div>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: 'var(--ink-1)',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.78rem',
                      }}
                    >
                      Probar enlace en pestaña nueva ↗
                    </a>
                  </div>
                </div>

                {/* CONDITIONAL BOLD VAULT */}
                {isBoldSelected && (
                  <div className="bold-vault-drawer">
                    <div className="bold-vault-header">
                      <h4>✦ Bóveda de Credenciales Bold</h4>
                      <button
                        type="button"
                        className="dash-btn-secondary"
                        onClick={handleVerifyBold}
                        disabled={verifyingBold}
                      >
                        {verifyingBold ? 'Consultando Bold...' : 'Diagnosticar Cuenta / Link en Bold'}
                      </button>
                    </div>

                    {boldVerifyResult && (
                      <div className={`dash-alert ${boldVerifyResult.ok ? 'success' : 'error'}`}>
                        <strong>Diagnóstico Bold ({boldVerifyResult.status}):</strong> {boldVerifyResult.detail}
                      </div>
                    )}

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
                      <label className="dash-label">NOMBRE DEL COMERCIO (CONCEPTO LIMPIO ANTI-BLOQUEO)</label>
                      <input
                        type="text"
                        className="dash-input"
                        placeholder="Paycenter"
                        value={boldMerchantName}
                        onChange={(e) => setBoldMerchantName(e.target.value)}
                      />
                      <p className="dash-hint">
                        El concepto del cobro viajará a nombre de tu comercio para proteger la reputación de la cuenta en Bold.
                      </p>
                    </div>
                  </div>
                )}

                <button type="submit" className="dash-btn-primary" disabled={saving}>
                  {saving ? 'Aplicando configuración en vivo...' : 'Guardar y Activar Pasarela en Caliente'}
                </button>
              </form>
            </div>

            {/* RIGHT COLUMN: ADMIN USERS VAULT + RESIDENTIAL PROXY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {isAdmin && (
                <div className="atelier-panel">
                  <div className="atelier-panel-head">
                    <div>
                      <h3>Control de Llaves de Acceso (Admin)</h3>
                      <p>
                        Crea contraseñas individuales para tus operadores. Ellos entran usando únicamente la clave que les asignes.
                      </p>
                    </div>
                  </div>

                  {userActionMsg && (
                    <div className={`dash-alert ${userActionMsg.type === 'success' ? 'success' : 'error'}`}>
                      {userActionMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} style={{ marginBottom: '22px' }}>
                    <div className="dash-btn-row" style={{ marginBottom: '12px' }}>
                      <div>
                        <label className="dash-label">NOMBRE DEL OPERADOR *</label>
                        <input
                          type="text"
                          className="dash-input"
                          placeholder="Ej: Operador Turno Día"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="dash-label">CONTRASEÑA ASIGNADA *</label>
                        <input
                          type="text"
                          className="dash-input mono"
                          placeholder="Ej: turno2026"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="dash-btn-row">
                      <select
                        className="dash-select"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                      >
                        <option value="user">Nivel: Operador (Solo Pasarelas)</option>
                        <option value="admin">Nivel: Administrador Total</option>
                      </select>
                      <button type="submit" className="dash-btn-primary" disabled={creatingUser}>
                        {creatingUser ? 'Registrando...' : '+ Emitir Contraseña'}
                      </button>
                    </div>
                  </form>

                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Clave Activa</th>
                          <th>Nivel</th>
                          <th>Gestión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <strong>{u.name}</strong>
                            </td>
                            <td>
                              <span className="url-id-chip">{u.password}</span>
                            </td>
                            <td>
                              <span
                                className={`dash-status-badge ${
                                  u.role === 'admin' ? 'APPROVED' : 'LINK_CREATED'
                                }`}
                              >
                                {u.role === 'admin' ? 'ADMIN' : 'OPERADOR'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="dash-btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleUpdateUserPassword(u)}
                                >
                                  Editar Clave
                                </button>
                                {u.id !== 'USR_MASTER_ADMIN' && (
                                  <button
                                    type="button"
                                    className="dash-btn-secondary"
                                    style={{
                                      padding: '6px 10px',
                                      fontSize: '0.75rem',
                                      color: 'var(--accent-bold)',
                                      borderColor: 'rgba(225, 29, 72, 0.3)',
                                    }}
                                    onClick={() => handleDeleteUser(u)}
                                  >
                                    Revocar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PROXY RESIDENCIAL */}
              <div className="atelier-panel">
                <div className="atelier-panel-head">
                  <div>
                    <h3>Nodo Proxy Residencial (Colombia)</h3>
                    <p>
                      Túnel SOCKS5/HTTP (IPRoyal) para que cada apertura de RappiPay o Bold salga con IP residencial nueva.
                    </p>
                  </div>
                </div>

                <div className="dash-form-group">
                  <label className="dash-label">HOST DEL PROXY</label>
                  <input
                    type="text"
                    className="dash-input mono"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                    placeholder="geo.iproyal.com"
                  />
                </div>

                <div className="dash-btn-row" style={{ marginBottom: '16px' }}>
                  <div>
                    <label className="dash-label">PUERTO</label>
                    <input
                      type="text"
                      className="dash-input mono"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                      placeholder="12321"
                    />
                  </div>
                  <div>
                    <label className="dash-label">USUARIO</label>
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
                  <label className="dash-label">PASSWORD (COUNTRY-CO)</label>
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
                  Guardar Parámetros de Red
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TRANSACTIONS LEDGER */}
        {(activeTab === 'all' || activeTab === 'transactions') && (
          <section className="atelier-panel" style={{ marginTop: '24px' }}>
            <div className="atelier-panel-head">
              <div>
                <h3>Libro Mayor de Transacciones en Tiempo Real</h3>
                <p>
                  Registro unificado de enlaces PSE generados y confirmaciones bancarias de <strong>RappiPay</strong> y <strong>Bold</strong>.
                </p>
              </div>
              <button
                type="button"
                className="dash-btn-secondary"
                onClick={loadDashboardData}
                disabled={loading}
              >
                {loading ? 'Sincronizando...' : 'Actualizar Libro ↻'}
              </button>
            </div>

            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Motor</th>
                    <th>Pagador / Documento</th>
                    <th>Entidad Bancaria</th>
                    <th>Monto COP</th>
                    <th>Estado</th>
                    <th>Enlace / Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--ink-3)' }}>
                        Aún no se han registrado cobros en esta sesión.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                          {new Date(tx.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td>
                          <span
                            className={`gateway-brand-pill ${
                              tx.gateway === 'rappipay' ? 'rappi' : 'bold'
                            }`}
                          >
                            {tx.gateway.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong>{tx.nombre}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>{tx.doc}</div>
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
                              style={{ color: 'var(--ink-1)', fontWeight: 700 }}
                            >
                              {tx.referenceId || 'Abrir PSE ↗'}
                            </a>
                          ) : (
                            tx.errorMessage || tx.referenceId || '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
