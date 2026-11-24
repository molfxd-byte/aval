import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  FirebaseAuthUser,
  getCurrentAuthUser,
  getFirebaseConfig,
  logoutFirebaseUser,
  loginWithPasswordOnly,
  createUserByAdmin,
  syncGatewayToFirestore,
  updateStoredAuthUserSlug,
} from '../../config/firebase.config';
import {
  IconZap,
  IconRefreshCw,
  IconFlask,
  IconCreditCard,
  IconShieldAlert,
  IconGlobe,
  IconKeyRound,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconSun,
  IconMoon,
  IconExternalLink,
  IconLogOut,
  IconCheckCircle,
  IconClock,
  IconXCircle,
  IconPlay,
  IconPlus,
  IconSparkles,
  IconArrowRight,
  IconCopy,
} from './DashboardIcons';
import './Dashboard.css';

type GatewayProvider = 'rappipay' | 'bold_api' | 'bold';
type ActiveSection = 'transactions' | 'portal' | 'gateways' | 'pool' | 'tester' | 'logs' | 'proxy' | 'users';

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

interface RappiLinkItem {
  id: string;
  url: string;
  linkCode: string;
  status: 'ACTIVE' | 'STANDBY' | 'BLOCKED';
  usesCount: number;
  addedAt: string;
  blockedAt?: string;
  blockReason?: string;
}

interface PoolSummary {
  activeUrl: string | null;
  activeTotal: number;
  standbyCount: number;
  blockedCount: number;
  totalInPool: number;
}

interface LinkEventLog {
  id: string;
  type: 'BLOCKED' | 'ROTATED' | 'ADDED' | 'TEST_OK' | 'TEST_FAIL';
  gateway: GatewayProvider;
  url: string;
  nextUrl?: string;
  reason: string;
  activeRemaining: number;
  blockedTotal: number;
  createdAt: string;
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
  status: 'INITIATED' | 'PROCESSING' | 'GENERATED' | 'APPROVED' | 'REJECTED' | 'ERROR';
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

interface PanelUserRecord {
  id: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  slug?: string;
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

function formatShortBlockReason(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean) return 'Link bloqueado por la pasarela';

  if (
    clean.includes('Activado manualmente') ||
    clean.includes('Se agregaron') ||
    clean.includes('Prueba exitosa')
  ) {
    return clean;
  }

  const lower = clean.toLowerCase();
  if (
    clean.includes('006_0769_FRAUD_TRANSACTION_BAD') ||
    clean.includes('Link de pago PSE rechazado') ||
    clean.includes('LINK_DEFINITIVAMENTE_BLOQUEADO')
  ) {
    return 'Link bloqueado por RappiPay (Rechazado por la pasarela)';
  }
  if (lower.includes('expiró') || lower.includes('expired')) {
    return 'Link bloqueado (Expirado en RappiPay)';
  }
  if (clean.includes('404') || clean.includes('Página no encontrada')) {
    return 'Link bloqueado (No encontrado o eliminado)';
  }
  if (
    lower.includes('timeout') ||
    clean.includes('No se generó redirección') ||
    clean.includes('No se detectó URL de redirección')
  ) {
    return 'Tiempo de espera agotado en la pasarela';
  }
  if (clean.length > 100) {
    return 'Link bloqueado por la pasarela';
  }
  return clean;
}

export default function Dashboard() {
  // ==================== THEME, SIDEBAR & VIEW STATE ====================
  const [theme, setTheme] = useState<'editorial' | 'obsidian'>(() => {
    return (localStorage.getItem('avalpay_dash_theme') as 'editorial' | 'obsidian') || 'editorial';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('avalpay_sidebar_collapsed') === 'true';
  });
  const [activeTab, setActiveTab] = useState<ActiveSection>('transactions');
  const [liveConnected, setLiveConnected] = useState(true);

  const toggleTheme = () => {
    const next = theme === 'editorial' ? 'obsidian' : 'editorial';
    setTheme(next);
    localStorage.setItem('avalpay_dash_theme', next);
  };

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('avalpay_sidebar_collapsed', String(next));
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
  const [paymentUrl, setPaymentUrl] = useState('');
  const [rappiUrl, setRappiUrl] = useState('');
  const [boldUrl, setBoldUrl] = useState('https://checkout.bold.co/payment/LNK_Z0PMCC30MQ');
  const [boldApiKey, setBoldApiKey] = useState('');
  const [boldSecretKey, setBoldSecretKey] = useState('');
  const [boldMerchantName, setBoldMerchantName] = useState('Paycenter');

  // RappiPay Multi-Link Pool & Logs State
  const [rappiPool, setRappiPool] = useState<RappiLinkItem[]>([]);
  const [poolSummary, setPoolSummary] = useState<PoolSummary>({
    activeUrl: null,
    activeTotal: 0,
    standbyCount: 0,
    blockedCount: 0,
    totalInPool: 0,
  });
  const [bulkRappiInput, setBulkRappiInput] = useState('');
  const [addingPool, setAddingPool] = useState(false);
  const [linkLogs, setLinkLogs] = useState<LinkEventLog[]>([]);

  // Live Link Tester / Simulator State
  const [testUrl, setTestUrl] = useState('');
  const [testMonto, setTestMonto] = useState('15000');
  const [testBanco, setTestBanco] = useState('NEQUI');
  const testTipo = 'Cédula de ciudadania';
  const [testDoc, setTestDoc] = useState('1032456789');
  const [testNombre, setTestNombre] = useState('Carlos Rodriguez');
  const [testEmail, setTestEmail] = useState('carlos.rodriguez@gmail.com');
  const [testingLink, setTestingLink] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: string;
    testedUrl: string;
    redirectUrl?: string;
    rotatedTo?: string | null;
    proxyIp?: string;
    durationMs?: number;
    detail: string;
  } | null>(null);

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

  // Transactions
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Admin User Management States (Only for Cuenta Admin)
  const [usersList, setUsersList] = useState<PanelUserRecord[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [userActionMsg, setUserActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // Custom Portal Extension (Slug) per User
  const [savedSlug, setSavedSlug] = useState<string>(() => authUser?.slug || '');
  const [mySlug, setMySlug] = useState<string>(() => authUser?.slug || '');
  const lastServerSlugRef = useRef<string>(authUser?.slug || '');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMessage, setSlugMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const currentUserId = authUser?.uid || 'USR_MASTER_ADMIN';

  const authHeaders = (extra?: Record<string, string>): Record<string, string> => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUserId,
    ...(extra || {}),
  });

  const applySnapshot = (data: any, includeFormFields = false) => {
    if (!data?.ok) return;
    if (data.userProfile?.slug) {
      const serverSlug = String(data.userProfile.slug).trim().toLowerCase();
      setSavedSlug(serverSlug);
      if (includeFormFields || lastServerSlugRef.current !== serverSlug) {
        setMySlug(serverSlug);
        lastServerSlugRef.current = serverSlug;
      }
      updateStoredAuthUserSlug(serverSlug);
    }
    if (includeFormFields && data.settings) {
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
      if (!testUrl) setTestUrl(s.paymentUrl);
    }
    if (Array.isArray(data.rappiPool)) setRappiPool(data.rappiPool);
    if (data.poolSummary) setPoolSummary(data.poolSummary);
    if (Array.isArray(data.linkLogs)) setLinkLogs(data.linkLogs);
    if (Array.isArray(data.transactions)) setTransactions(data.transactions);
  };

  const loadDashboardData = async (includeFormFields = true) => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/admin/settings?userId=${encodeURIComponent(currentUserId)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      applySnapshot(data, includeFormFields);

      if (authUser?.role === 'admin') {
        const uRes = await fetch(`${apiBase}/admin/users`, {
          headers: authHeaders(),
        });
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
    if (!authUser) return;
    loadDashboardData(true);

    // 1. Conexión en tiempo real instantánea vía Server-Sent Events (/api/admin/stream) aislada por usuario
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${apiBase}/admin/stream?userId=${encodeURIComponent(currentUserId)}`);
      es.onopen = () => setLiveConnected(true);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          applySnapshot(parsed, false);
          setLiveConnected(true);
        } catch {
          // ignore
        }
      };
      es.onerror = () => setLiveConnected(false);
    } catch {
      // ignore if EventSource unsupported
    }

    // 2. Respaldo de sincronización cada 3 segundos
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/admin/settings?userId=${encodeURIComponent(currentUserId)}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        applySnapshot(data, false);
      } catch {
        // ignore silent poll error
      }
    }, 3000);

    return () => {
      if (es) es.close();
      window.clearInterval(interval);
    };
  }, [authUser, currentUserId]);

  // Smart URL auto-detection as the user types or pastes a link
  const detectedInfo = useMemo(() => detectUrlClientSide(paymentUrl), [paymentUrl]);

  // Compute pending, completed & canceled financial totals dynamically from transactions
  const computedFinancials = useMemo(() => {
    const completedList = transactions.filter((t) => t.status === 'APPROVED');
    const pendingList = transactions.filter(
      (t) => t.status === 'GENERATED' || t.status === 'PROCESSING' || t.status === 'INITIATED'
    );
    const canceledList = transactions.filter(
      (t) => t.status === 'REJECTED' || t.status === 'ERROR'
    );
    const redirectedCount = transactions.filter((t) => t.status === 'GENERATED').length;
    const inProcessCount = transactions.filter(
      (t) => t.status === 'INITIATED' || t.status === 'PROCESSING'
    ).length;

    const totalRecaudado = completedList.reduce((acc, t) => acc + Number(t.monto || 0), 0);
    const saldoPendiente = pendingList.reduce((acc, t) => acc + Number(t.monto || 0), 0);
    const totalCancelado = canceledList.reduce((acc, t) => acc + Number(t.monto || 0), 0);

    return {
      totalRecaudado,
      completedCount: completedList.length,
      saldoPendiente,
      pendingCount: pendingList.length,
      totalCancelado,
      canceledCount: canceledList.length,
      redirectedCount,
      inProcessCount,
    };
  }, [transactions]);

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
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo guardar la configuración');
      }

      applySnapshot(data, true);

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

  // ==================== CUSTOM PORTAL EXTENSION (SLUG) HANDLER ====================
  const handleSaveMySlug = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlug(true);
    setSlugMessage(null);
    try {
      const res = await fetch(`${apiBase}/admin/my-slug`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ slug: mySlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo guardar tu extensión');
      }
      const nextSlug = String(data.user.slug || '').trim().toLowerCase();
      setSavedSlug(nextSlug);
      setMySlug(nextSlug);
      lastServerSlugRef.current = nextSlug;
      if (nextSlug) {
        const updatedAuth = updateStoredAuthUserSlug(nextSlug);
        if (updatedAuth) {
          setAuthUser(updatedAuth);
        } else {
          setAuthUser((prev) => (prev ? { ...prev, slug: nextSlug } : prev));
        }
      }
      if (Array.isArray(data.users)) {
        setUsersList(data.users);
      }
      setSlugMessage({
        type: 'success',
        text: `¡Extensión personalizada actualizada! Tu link exclusivo ahora es: ${window.location.origin}/${data.user.slug}`,
      });
    } catch (err: any) {
      setSlugMessage({
        type: 'error',
        text: err.message || 'Error guardando la extensión',
      });
    } finally {
      setSavingSlug(false);
    }
  };

  // ==================== TRANSACTION STATUS UPDATE (PENDIENTE / REDIRIGIDO / TERMINADO) ====================
  const handleChangeTransactionStatus = async (
    txId: string,
    nextStatus: TransactionRecord['status']
  ) => {
    try {
      const res = await fetch(`${apiBase}/admin/transactions/${encodeURIComponent(txId)}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      applySnapshot(data, false);
    } catch (err) {
      console.error('Error actualizando estado de transacción:', err);
    }
  };

  // ==================== RAPPIPAY POOL HANDLERS ====================
  const handleAddPoolLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRappiInput.trim()) return;
    setAddingPool(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${apiBase}/admin/rappi-pool`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ urls: bulkRappiInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error agregando links a la cola');
      }
      applySnapshot(data, true);
      setBulkRappiInput('');
      setSaveMessage({
        type: 'success',
        text: `Links agregados a tu rotación automática (${data.poolSummary?.activeTotal || 0} activos en cola).`,
      });
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: err.message || 'No se pudieron agregar los links',
      });
    } finally {
      setAddingPool(false);
    }
  };

  const handleActivatePoolItem = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/admin/rappi-pool/activate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      applySnapshot(data, true);
    } catch (err) {
      console.error('Error activando link del pool:', err);
    }
  };

  const handleDeletePoolItem = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/admin/rappi-pool/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      applySnapshot(data, true);
    } catch (err) {
      console.error('Error eliminando link del pool:', err);
    }
  };

  // ==================== LIVE LINK SIMULATOR / TESTER HANDLER ====================
  const handleRunLinkTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingLink(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiBase}/admin/test-link`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          url: testUrl || paymentUrl,
          monto: testMonto,
          banco: testBanco,
          tipo: testTipo,
          doc: testDoc,
          nombre: testNombre,
          email: testEmail,
        }),
      });
      const data = await res.json();
      setTestResult({
        ok: Boolean(data.ok),
        status: data.status || 'ERROR',
        testedUrl: data.testedUrl || testUrl || paymentUrl,
        redirectUrl: data.redirectUrl,
        rotatedTo: data.rotatedTo,
        proxyIp: data.proxyIp,
        durationMs: data.durationMs,
        detail: data.detail || 'Prueba finalizada',
      });
      applySnapshot(data, true);
    } catch (err: any) {
      setTestResult({
        ok: false,
        status: 'ERROR',
        testedUrl: testUrl || paymentUrl,
        detail: err.message || 'Error ejecutando la prueba del link',
      });
    } finally {
      setTestingLink(false);
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
      const userSlug = (user.slug || '').trim().toLowerCase();
      setSavedSlug(userSlug);
      setMySlug(userSlug);
      lastServerSlugRef.current = userSlug;
      setSlugMessage(null);
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
          <aside className="vault-showcase">
            <div className="vault-showcase-top">
              <div className="vault-monogram">
                <div className="vault-crest">A</div>
                <span className="vault-monogram-text">AvalPay Private Suite</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#8a847c' }}>
                v4.0 // {currentFbCfg.projectId}
              </span>
            </div>

            <div className="vault-hero-quote">
              <div className="vault-hero-tag">
                <IconSparkles size={14} /> Orquestador Ejecutivo de Pasarelas
              </div>
              <h1>Control unificado con rotación automática de links.</h1>
              <p>
                Conmutación en caliente entre colas de enlaces de <strong>RappiPay PSE</strong> y credenciales de{' '}
                <strong>Bold API Oficial</strong> con simulador de pruebas en vivo y alertas a Telegram.
              </p>
            </div>

            <div className="vault-feature-pills">
              <div className="vault-feature-item">
                <strong>Rotación Automática</strong>
                <span>Si un link de RappiPay se bloquea, salta al siguiente.</span>
              </div>
              <div className="vault-feature-item">
                <strong>Simulador PSE en Vivo</strong>
                <span>Prueba cualquier link y obtén la redirección bancaria.</span>
              </div>
              <div className="vault-feature-item">
                <strong>Alertas a Telegram</strong>
                <span>Reporte de links quemados y cuántos quedan activos.</span>
              </div>
            </div>
          </aside>

          <section className="vault-auth-pane">
            <div style={{ position: 'absolute', top: '24px', right: '28px' }}>
              <button type="button" className="atelier-icon-btn" onClick={toggleTheme}>
                {theme === 'editorial' ? (
                  <>
                    <IconMoon size={15} /> Modo Obsidiana
                  </>
                ) : (
                  <>
                    <IconSun size={15} /> Modo Marfil
                  </>
                )}
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
                  <IconArrowRight size={16} />
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
    <div className={`dash-root app-mode ${theme === 'obsidian' ? 'theme-obsidian' : ''}`}>
      {/* TOP NAVIGATION BAR */}
      <header className="atelier-nav">
        <div className="atelier-nav-inner" style={{ maxWidth: '1540px' }}>
          <div className="atelier-brand">
            <button
              type="button"
              className="atelier-icon-btn"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Desplegar barra lateral' : 'Ocultar barra lateral'}
              style={{ padding: '8px 11px' }}
            >
              {sidebarCollapsed ? <IconPanelLeftOpen size={17} /> : <IconPanelLeftClose size={17} />}
            </button>
            <div className="atelier-logo">A</div>
            <div className="atelier-brand-title">
              <h1>AvalPay Private Suite</h1>
              <span>
                {authUser.name.toUpperCase()} · {isAdmin ? 'CUENTA ADMIN' : 'OPERADOR'} ·{' '}
                {liveConnected ? 'STREAM EN VIVO' : 'SINCRONIZANDO'}
              </span>
            </div>
          </div>

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
              {theme === 'editorial' ? (
                <>
                  <IconMoon size={15} /> Obsidiana
                </>
              ) : (
                <>
                  <IconSun size={15} /> Marfil
                </>
              )}
            </button>

            <a
              href={savedSlug ? `/${savedSlug}` : '/'}
              target="_blank"
              rel="noreferrer"
              className="atelier-icon-btn"
              title={savedSlug ? `Abrir tu portal: /${savedSlug}` : 'Abrir Portal Público Principal'}
            >
              Portal Público {savedSlug ? `(/${savedSlug})` : ''} <IconExternalLink size={14} />
            </a>

            <button
              type="button"
              className="atelier-icon-btn"
              onClick={() => {
                logoutFirebaseUser();
                setSavedSlug('');
                setMySlug('');
                lastServerSlugRef.current = '';
                setSlugMessage(null);
                setAuthUser(null);
              }}
            >
              <IconLogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* COLLAPSIBLE SIDEBAR + WORKSPACE SHELL */}
      <div className="atelier-app-shell">
        <aside className={`atelier-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div>
            <div className="sidebar-section-label">OPERACIÓN</div>
            <div className="sidebar-nav-list">
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
                onClick={() => setActiveTab('transactions')}
                title="Transacciones & Saldos"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconCreditCard size={18} /></span>
                  <span className="sidebar-link-text">Transacciones</span>
                </span>
                <span className="sidebar-badge">{transactions.length}</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'portal' ? 'active' : ''}`}
                onClick={() => setActiveTab('portal')}
                title="Mi Enlace del Portal de Pagos"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconExternalLink size={18} /></span>
                  <span className="sidebar-link-text">Mi Enlace Portal</span>
                </span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'gateways' ? 'active' : ''}`}
                onClick={() => setActiveTab('gateways')}
                title="Pasarela & Llaves"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconZap size={18} /></span>
                  <span className="sidebar-link-text">Pasarela & Llaves</span>
                </span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'pool' ? 'active' : ''}`}
                onClick={() => setActiveTab('pool')}
                title="Cola Auto-Rotación Rappi"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconRefreshCw size={18} /></span>
                  <span className="sidebar-link-text">Cola Links RappiPay</span>
                </span>
                <span className="sidebar-badge">{poolSummary.activeTotal}</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tester' ? 'active' : ''}`}
                onClick={() => setActiveTab('tester')}
                title="Probador de Links en Vivo"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconFlask size={18} /></span>
                  <span className="sidebar-link-text">Probador de Links</span>
                </span>
              </button>
            </div>

            <div className="sidebar-section-label">MONITOREO & CONFIGURACIÓN</div>
            <div className="sidebar-nav-list">
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
                title="Logs de Bloqueos y Rotaciones"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconShieldAlert size={18} /></span>
                  <span className="sidebar-link-text">Logs de Bloqueos</span>
                </span>
                <span className="sidebar-badge">{poolSummary.blockedCount}</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'proxy' ? 'active' : ''}`}
                onClick={() => setActiveTab('proxy')}
                title="Proxy Residencial IPRoyal"
              >
                <span className="sidebar-item-left">
                  <span className="sidebar-icon"><IconGlobe size={18} /></span>
                  <span className="sidebar-link-text">Red & Proxy</span>
                </span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                  title="Control de Usuarios y Claves"
                >
                  <span className="sidebar-item-left">
                    <span className="sidebar-icon"><IconKeyRound size={18} /></span>
                    <span className="sidebar-link-text">Accesos (Admin)</span>
                  </span>
                  <span className="sidebar-badge">{usersList.length}</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="button" className="sidebar-collapse-btn" onClick={toggleSidebar}>
              {sidebarCollapsed ? <IconPanelLeftOpen size={16} /> : <IconPanelLeftClose size={16} />}
              <span className="sidebar-link-text">Ocultar Barra Lateral</span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="atelier-main-workspace">
          {/* KPI CARDS (SOLO EN SECCIÓN DE TRANSACCIONES) */}
          {activeTab === 'transactions' && (
            <section className="atelier-bento-metrics">
            <div className="atelier-metric-card featured">
              <div className="atelier-metric-top">
                <span>MOTOR DE COBRO EN VIVO</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <IconZap size={13} /> {gatewayProvider.toUpperCase()}
                </span>
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
                <span>TOTAL RECAUDADO (TERMINADOS)</span>
                <span style={{ color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <IconCheckCircle size={13} /> {computedFinancials.completedCount} COMPLETADOS
                </span>
              </div>
              <div className="atelier-metric-val" style={{ color: 'var(--accent-emerald)' }}>
                ${computedFinancials.totalRecaudado.toLocaleString('es-CO')}
              </div>
              <div className="atelier-metric-foot">
                Suma total de pagos finalizados con éxito
              </div>
            </div>

            <div className="atelier-metric-card">
              <div className="atelier-metric-top">
                <span>SALDOS PENDIENTES (EN CURSO)</span>
                <span style={{ color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <IconClock size={13} /> {computedFinancials.pendingCount} EN TRÁNSITO
                </span>
              </div>
              <div className="atelier-metric-val" style={{ color: 'var(--accent-gold)' }}>
                ${computedFinancials.saldoPendiente.toLocaleString('es-CO')}
              </div>
              <div className="atelier-metric-foot">
                {computedFinancials.redirectedCount} redirigidos a PSE · {computedFinancials.inProcessCount} pendientes
              </div>
            </div>

            <div className="atelier-metric-card">
              <div className="atelier-metric-top">
                <span>PAGOS CANCELADOS</span>
                <span style={{ color: 'var(--accent-bold)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <IconXCircle size={13} /> {computedFinancials.canceledCount} CANCELADOS
                </span>
              </div>
              <div className="atelier-metric-val" style={{ color: 'var(--accent-bold)' }}>
                ${computedFinancials.totalCancelado.toLocaleString('es-CO')}
              </div>
              <div className="atelier-metric-foot">
                Pagos salidos o cancelados en PSE
              </div>
            </div>

            <div className="atelier-metric-card">
              <div className="atelier-metric-top">
                <span>POOL DE LINKS RAPPIPAY</span>
                <span style={{ color: 'var(--accent-rappi)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <IconRefreshCw size={13} /> AUTO-ROTACIÓN
                </span>
              </div>
              <div className="atelier-metric-val">
                {poolSummary.activeTotal} Activos / {poolSummary.blockedCount} Bloq.
              </div>
              <div className="atelier-metric-foot">
                {poolSummary.standbyCount} links en cola de relevo inmediato
              </div>
            </div>
            </section>
          )}

          {/* ==================== 0. PERSONAL PORTAL EXTENSION / TENANT SLUG ==================== */}
          {activeTab === 'portal' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
              <div className="atelier-panel-head">
                <div>
                  <h3>Mi Enlace Personalizado del Portal de Pagos</h3>
                  <p>
                    Elige el nombre de tu extensión personal. Todo cliente que entre por tu link usará <strong>únicamente tu cola de links RappiPay / Bold</strong> y los pagos se reflejarán solo en tu cuenta sin mezclarse con otros usuarios.
                  </p>
                </div>
                <span className="dash-status-badge APPROVED" style={{ gap: '5px' }}>
                  <IconCheckCircle size={13} /> CUENTA AISLADA ({authUser.name.toUpperCase()})
                </span>
              </div>

              {slugMessage && (
                <div className={`dash-alert ${slugMessage.type === 'success' ? 'success' : 'error'}`}>
                  {slugMessage.text}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  marginBottom: '14px',
                  borderRadius: '16px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="dash-label" style={{ marginBottom: 0 }}>
                    TU ENLACE ACTIVO DEL PORTAL
                  </span>
                  <a
                    href={savedSlug ? `/${savedSlug}` : '/'}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                    style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink-1)', wordBreak: 'break-all' }}
                  >
                    {(typeof window !== 'undefined'
                      ? window.location.origin
                      : 'https://avalpaycenter.up.railway.app') + (savedSlug ? `/${savedSlug}` : '/')}
                  </a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                  <span className="dash-label" style={{ marginBottom: 0 }}>
                    LINK DE COBRO ACTIVO CONECTADO
                  </span>
                  <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                    {poolSummary.activeUrl || paymentUrl || 'Sin link activo configurado'}
                  </span>
                </div>
              </div>

              <form
                onSubmit={handleSaveMySlug}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '12px',
                  alignItems: 'center',
                  background: 'var(--surface-2)',
                  padding: '16px 20px',
                  borderRadius: '18px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {typeof window !== 'undefined' ? window.location.origin : 'https://avalpaycenter.up.railway.app'}/
                  </span>
                  <input
                    type="text"
                    className="dash-input mono"
                    style={{ maxWidth: '280px', fontWeight: 700 }}
                    placeholder={isAdmin ? 'principal (o escribe tu extensión)' : 'ej: pagos-carlos'}
                    value={mySlug}
                    onChange={(e) => setMySlug(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="dash-btn-primary"
                  disabled={savingSlug}
                  style={{ width: 'auto', padding: '12px 20px', whiteSpace: 'nowrap' }}
                >
                  {savingSlug ? 'Guardando...' : 'Guardar Extensión'}
                </button>

                <button
                  type="button"
                  className="dash-btn-secondary"
                  style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const origin =
                      typeof window !== 'undefined'
                        ? window.location.origin
                        : 'https://avalpaycenter.up.railway.app';
                    const clean = (savedSlug || mySlug).trim().replace(/^\/+/, '');
                    const fullUrl = clean ? `${origin}/${clean}` : `${origin}/`;
                    navigator.clipboard.writeText(fullUrl);
                    setSlugMessage({
                      type: 'success',
                      text: `Enlace copiado al portapapeles: ${fullUrl}`,
                    });
                  }}
                >
                  <IconCopy size={14} /> Copiar Mi Link
                </button>
              </form>
            </section>
          )}

          {/* ==================== 1. FULL-WIDTH EXPANDED RAPPIPAY POOL ==================== */}
          {activeTab === 'pool' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
              <div className="atelier-panel-head">
                <div>
                  <h3>Cola de Links RappiPay (Auto-Rotación Inteligente)</h3>
                  <p>
                    Carga varios links de RappiPay a la vez. Cuando el link actual sea rechazado o bloqueado, el sistema <strong>lo marca como bloqueado, activa el siguiente de la cola automáticamente</strong> y envía el reporte a Telegram.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="dash-status-badge APPROVED" style={{ gap: '5px' }}>
                    <IconCheckCircle size={13} /> {poolSummary.activeTotal} ACTIVOS / EN COLA
                  </span>
                  <span className="dash-status-badge REJECTED" style={{ gap: '5px' }}>
                    <IconXCircle size={13} /> {poolSummary.blockedCount} BLOQUEADOS
                  </span>
                </div>
              </div>

              <div className="pool-expanded-grid">
                {/* LEFT SIDE: ADD LINKS FORM */}
                <form
                  onSubmit={handleAddPoolLinks}
                  style={{
                    background: 'var(--surface-2)',
                    padding: '20px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <label className="dash-label">
                    PEGAR UNO O VARIOS LINKS DE RAPPIPAY (UNO POR LÍNEA)
                  </label>
                  <textarea
                    rows={5}
                    className="dash-textarea mono"
                    placeholder={`https://linkdepagospse.rappipay.co/v9eMyD\nhttps://linkdepagospse.rappipay.co/x7kLpQ\nhttps://linkdepagospse.rappipay.co/m4nBwZ`}
                    value={bulkRappiInput}
                    onChange={(e) => setBulkRappiInput(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  />
                  <button
                    type="submit"
                    className="dash-btn-primary"
                    disabled={addingPool}
                  >
                    {addingPool ? 'Agregando a la cola...' : '+ Agregar Links a la Cola Automática'}
                  </button>
                  <p className="dash-hint" style={{ marginTop: '10px' }}>
                    El primer link quedará en uso activo y los siguientes entrarán en orden apenas uno deje de funcionar.
                  </p>
                </form>

                {/* RIGHT SIDE: FULL-WIDTH EXPANDED POOL TABLE WITH SCROLL */}
                <div className="dash-table-wrap pool-scroll">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>URL del Link RappiPay</th>
                        <th>Estado</th>
                        <th>Usos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rappiPool.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-3)' }}>
                            No hay links cargados en la cola de rotación.
                          </td>
                        </tr>
                      ) : (
                        rappiPool.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <span className="url-id-chip">{item.linkCode}</span>
                            </td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                              <div>{item.url}</div>
                              {item.blockReason && (
                                <div style={{ color: 'var(--accent-bold)', fontSize: '0.73rem', marginTop: '4px' }}>
                                  Motivo bloqueo: {formatShortBlockReason(item.blockReason)}
                                </div>
                              )}
                            </td>
                            <td>
                              <span
                                className={`dash-status-badge ${
                                  item.status === 'ACTIVE'
                                    ? 'APPROVED'
                                    : item.status === 'STANDBY'
                                    ? 'LINK_CREATED'
                                    : 'REJECTED'
                                }`}
                                style={{ gap: '5px' }}
                              >
                                {item.status === 'ACTIVE' ? (
                                  <>
                                    <IconCheckCircle size={13} /> ACTIVO
                                  </>
                                ) : item.status === 'STANDBY' ? (
                                  <>
                                    <IconClock size={13} /> EN COLA
                                  </>
                                ) : (
                                  <>
                                    <IconXCircle size={13} /> BLOQ.
                                  </>
                                )}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                              {item.usesCount || 0}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                {item.status !== 'ACTIVE' && (
                                  <button
                                    type="button"
                                    className="dash-btn-secondary"
                                    style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                                    onClick={() => handleActivatePoolItem(item.id)}
                                  >
                                    Usar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="dash-btn-secondary"
                                  style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                                  onClick={() => {
                                    setTestUrl(item.url);
                                    setActiveTab('tester');
                                  }}
                                >
                                  Probar
                                </button>
                                <button
                                  type="button"
                                  className="dash-btn-secondary"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.74rem',
                                    color: 'var(--accent-bold)',
                                    borderColor: 'rgba(225, 29, 72, 0.3)',
                                  }}
                                  onClick={() => handleDeletePoolItem(item.id)}
                                >
                                  Quitar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ==================== 2. GATEWAY ORCHESTRATOR ==================== */}
          {activeTab === 'gateways' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
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
                        <span>Soporta cola de links con auto-rotación.</span>
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

                    <div className="url-inspector-box">
                      <div className="url-inspector-top">
                        <label className="dash-label" style={{ marginBottom: 0 }}>
                          2. ENLACE DE COBRO PRINCIPAL ACTIVO *
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
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setTestUrl(paymentUrl);
                              setActiveTab('tester');
                            }}
                          >
                            Probar en el Simulador →
                          </button>
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
                            Abrir ↗
                          </a>
                        </div>
                      </div>
                    </div>

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
                        </div>
                      </div>
                    )}

                    <button type="submit" className="dash-btn-primary" disabled={saving}>
                      {saving ? 'Aplicando configuración en vivo...' : 'Guardar y Activar Pasarela en Caliente'}
                    </button>
                  </form>
            </section>
          )}

          {/* ==================== 2B. USERS & ACCESS (ADMIN) ==================== */}
          {isAdmin && activeTab === 'users' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
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
                            <th>Extensión Portal</th>
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
                                <span className="url-id-chip">
                                  /{u.slug || (u.id === 'USR_MASTER_ADMIN' ? '' : u.id.toLowerCase())}
                                </span>
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
            </section>
          )}

          {/* ==================== 2C. PROXY & NETWORK ==================== */}
          {activeTab === 'proxy' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
              <div className="atelier-panel-head">
                <div>
                  <h3>Nodo Proxy Residencial (Colombia)</h3>
                  <p>
                    Túnel SOCKS5/HTTP (IPRoyal) para que cada apertura de RappiPay o Bold salga con IP residencial nueva.
                  </p>
                </div>
              </div>

              {saveMessage && (
                <div className={`dash-alert ${saveMessage.type === 'success' ? 'success' : 'error'}`}>
                  {saveMessage.text}
                </div>
              )}

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
            </section>
          )}

          {/* ==================== 3. SIMULADOR / PROBADOR DE LINKS EN VIVO ==================== */}
          {activeTab === 'tester' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
              <div className="atelier-panel-head">
                <div>
                  <h3>Simulador y Probador de Links en Vivo</h3>
                  <p>
                    Prueba cualquier link de <strong>RappiPay</strong> o <strong>Bold</strong> con datos de prueba reales. Te indicaremos si el link sigue activo y te entregaremos la <strong>URL de redirección bancaria PSE</strong> para que compruebes que funciona.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRunLinkTest}>
                <div className="dash-form-group">
                  <label className="dash-label">URL DEL LINK A PROBAR *</label>
                  <input
                    type="url"
                    className="dash-input mono"
                    value={testUrl || paymentUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://linkdepagospse.rappipay.co/v9eMyD"
                    required
                  />
                </div>

                <div className="gateway-tiles" style={{ marginBottom: '18px' }}>
                  <div>
                    <label className="dash-label">MONTO DE PRUEBA (COP)</label>
                    <input
                      type="number"
                      className="dash-input mono"
                      value={testMonto}
                      onChange={(e) => setTestMonto(e.target.value)}
                      min={10000}
                      required
                    />
                  </div>
                  <div>
                    <label className="dash-label">BANCO DE PRUEBA</label>
                    <select
                      className="dash-select"
                      value={testBanco}
                      onChange={(e) => setTestBanco(e.target.value)}
                    >
                      <option value="NEQUI">NEQUI</option>
                      <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                      <option value="DAVIPLATA">DAVIPLATA</option>
                      <option value="BANCO DE BOGOTA">BANCO DE BOGOTÁ</option>
                      <option value="BANCO DAVIVIENDA">BANCO DAVIVIENDA</option>
                      <option value="BANCO AV VILLAS">BANCO AV VILLAS</option>
                    </select>
                  </div>
                  <div>
                    <label className="dash-label">DOCUMENTO DE PRUEBA</label>
                    <input
                      type="text"
                      className="dash-input mono"
                      value={testDoc}
                      onChange={(e) => setTestDoc(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="dash-btn-row" style={{ marginBottom: '18px' }}>
                  <div>
                    <label className="dash-label">NOMBRE DEL PAGADOR</label>
                    <input
                      type="text"
                      className="dash-input"
                      value={testNombre}
                      onChange={(e) => setTestNombre(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="dash-label">CORREO ELECTRÓNICO</label>
                    <input
                      type="email"
                      className="dash-input mono"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="dash-btn-primary" disabled={testingLink} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <IconPlay size={15} />
                  {testingLink
                    ? 'Ejecutando prueba real en la pasarela (15-25s)...'
                    : 'Probar Link Ahora y Obtener Redirección PSE'}
                </button>
              </form>

              {testResult && (
                <div
                  className="url-inspector-box"
                  style={{
                    marginTop: '22px',
                    marginBottom: 0,
                    borderColor: testResult.ok ? 'var(--accent-emerald)' : 'var(--accent-bold)',
                  }}
                >
                  <div className="url-inspector-top">
                    <span className={`dash-status-badge ${testResult.ok ? 'APPROVED' : 'REJECTED'}`} style={{ gap: '5px' }}>
                      {testResult.ok ? (
                        <>
                          <IconCheckCircle size={13} /> LINK ACTIVO Y OPERATIVO
                        </>
                      ) : (
                        <>
                          <IconXCircle size={13} /> LINK BLOQUEADO / CON FALLO
                        </>
                      )}
                    </span>
                    {testResult.durationMs && (
                      <span className="url-id-chip">
                        Tiempo: {(testResult.durationMs / 1000).toFixed(1)}s · IP Proxy: {testResult.proxyIp || 'N/A'}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '10px 0', fontSize: '0.92rem', fontWeight: 600 }}>
                    {testResult.ok ? testResult.detail : formatShortBlockReason(testResult.detail)}
                  </p>

                  {testResult.rotatedTo && (
                    <div className="dash-alert error" style={{ marginBottom: '12px' }}>
                      <strong>Auto-Rotación ejecutada:</strong> Como este link falló, el sistema activó automáticamente el siguiente link de la cola: <code>{testResult.rotatedTo}</code>
                    </div>
                  )}

                  {testResult.redirectUrl && (
                    <div
                      style={{
                        background: 'var(--surface-1)',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: '1px solid var(--border-soft)',
                        marginTop: '12px',
                      }}
                    >
                      <div className="dash-label" style={{ marginBottom: '6px' }}>
                        URL DE REDIRECCIÓN BANCARIA PSE GENERADA:
                      </div>
                      <div
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.8rem',
                          wordBreak: 'break-all',
                          marginBottom: '12px',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {testResult.redirectUrl}
                      </div>
                      <a
                        href={testResult.redirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="dash-btn-primary"
                        style={{
                          display: 'inline-block',
                          width: 'auto',
                          textDecoration: 'none',
                          padding: '11px 20px',
                        }}
                      >
                        Abrir Redirección Bancaria PSE para Verificar ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ==================== 4. BITÁCORA DE LINKS BLOQUEADOS Y ROTACIONES ==================== */}
          {activeTab === 'logs' && (
            <section className="atelier-panel" style={{ marginBottom: '24px' }}>
              <div className="atelier-panel-head">
                <div>
                  <h3>Bitácora de Links Bloqueados y Rotaciones Automáticas</h3>
                  <p>
                    Avisos en tiempo real de cuándo un link dejó de funcionar, a cuál link rotó automáticamente y el balance de links activos vs bloqueados (sincronizado con Telegram).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className="dash-status-badge APPROVED">
                    ACTIVOS AÚN: {poolSummary.activeTotal}
                  </span>
                  <span className="dash-status-badge REJECTED">
                    BLOQUEADOS: {poolSummary.blockedCount}
                  </span>
                </div>
              </div>

              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Evento</th>
                      <th>Pasarela</th>
                      <th>Link Afectado / Probado</th>
                      <th>Relevo / Redirección</th>
                      <th>Detalle / Motivo</th>
                      <th>Balance Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-3)' }}>
                          No se han registrado bloqueos ni rotaciones de links hasta el momento.
                        </td>
                      </tr>
                    ) : (
                      linkLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem' }}>
                            {new Date(log.createdAt).toLocaleString('es-CO')}
                          </td>
                          <td>
                            <span
                              className={`dash-status-badge ${
                                log.type === 'TEST_OK' || log.type === 'ADDED'
                                  ? 'APPROVED'
                                  : log.type === 'ROTATED'
                                  ? 'LINK_CREATED'
                                  : 'REJECTED'
                              }`}
                              style={{ gap: '5px' }}
                            >
                              {log.type === 'BLOCKED' ? (
                                <>
                                  <IconShieldAlert size={13} /> BLOQUEADO
                                </>
                              ) : log.type === 'ROTATED' ? (
                                <>
                                  <IconRefreshCw size={13} /> AUTO-ROTADO
                                </>
                              ) : log.type === 'TEST_OK' ? (
                                <>
                                  <IconCheckCircle size={13} /> PRUEBA OK
                                </>
                              ) : log.type === 'ADDED' ? (
                                <>
                                  <IconPlus size={13} /> EN COLA
                                </>
                              ) : (
                                <>
                                  <IconXCircle size={13} /> FALLO
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`gateway-brand-pill ${
                                log.gateway === 'rappipay' ? 'rappi' : 'bold'
                              }`}
                            >
                              {log.gateway.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                            {log.url}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem' }}>
                            {log.nextUrl ? (
                              <a
                                href={log.nextUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--ink-1)', fontWeight: 700 }}
                              >
                                {log.type === 'TEST_OK' ? 'Ver Redirección PSE ↗' : `Rotó a: ${log.nextUrl}`}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem', maxWidth: '320px' }}>{formatShortBlockReason(log.reason)}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem' }}>
                            {log.activeRemaining} act / {log.blockedTotal} bloq
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ==================== 5. TRANSACTIONS LEDGER (PENDIENTE / REDIRIGIDO / TERMINADO) ==================== */}
          {activeTab === 'transactions' && (
            <section className="atelier-panel">
              <div className="atelier-panel-head">
                <div>
                  <h3>Libro Mayor de Transacciones en Tiempo Real</h3>
                  <p>
                    Seguimiento en vivo de cada cobro en sus 4 etapas: <strong>Pendiente</strong> (en proceso), <strong>Redirigido</strong> (cliente en PSE), <strong>Terminado</strong> (suma al Total Recaudado) y <strong>Cancelado</strong> (suma a Pagos Cancelados).
                  </p>
                </div>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() => loadDashboardData(false)}
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
                      <th>Banco</th>
                      <th>Monto COP</th>
                      <th>Estado Actual</th>
                      <th>Marcar Etapa (En Vivo)</th>
                      <th>Enlace PSE / Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--ink-3)' }}>
                          Aún no se han registrado cobros en esta sesión.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => {
                        const isPending = tx.status === 'INITIATED' || tx.status === 'PROCESSING';
                        const isRedirected = tx.status === 'GENERATED';
                        const isCompleted = tx.status === 'APPROVED';
                        const isCanceled = tx.status === 'REJECTED' || tx.status === 'ERROR';

                        return (
                          <tr key={tx.id}>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem' }}>
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
                                  isCompleted
                                    ? 'APPROVED'
                                    : isRedirected || isPending
                                    ? 'LINK_CREATED'
                                    : 'REJECTED'
                                }`}
                                style={{ gap: '5px' }}
                              >
                                {isPending ? (
                                  <>
                                    <IconClock size={13} /> PENDIENTE
                                  </>
                                ) : isRedirected ? (
                                  <>
                                    <IconExternalLink size={13} /> REDIRIGIDO
                                  </>
                                ) : isCompleted ? (
                                  <>
                                    <IconCheckCircle size={13} /> TERMINADO
                                  </>
                                ) : (
                                  <>
                                    <IconXCircle size={13} /> CANCELADO
                                  </>
                                )}
                              </span>
                            </td>
                            <td>
                              <div className="tx-state-pills">
                                <button
                                  type="button"
                                  className={`tx-state-btn ${isPending ? 'active-pending' : ''}`}
                                  onClick={() => handleChangeTransactionStatus(tx.id, 'PROCESSING')}
                                >
                                  Pendiente
                                </button>
                                <button
                                  type="button"
                                  className={`tx-state-btn ${isRedirected ? 'active-redirected' : ''}`}
                                  onClick={() => handleChangeTransactionStatus(tx.id, 'GENERATED')}
                                >
                                  Redirigido
                                </button>
                                <button
                                  type="button"
                                  className={`tx-state-btn ${isCompleted ? 'active-completed' : ''}`}
                                  onClick={() => handleChangeTransactionStatus(tx.id, 'APPROVED')}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <IconCheckCircle size={12} /> Terminado
                                </button>
                                <button
                                  type="button"
                                  className={`tx-state-btn ${isCanceled ? 'active-canceled' : ''}`}
                                  onClick={() => handleChangeTransactionStatus(tx.id, 'REJECTED')}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <IconXCircle size={12} /> Cancelado
                                </button>
                              </div>
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
