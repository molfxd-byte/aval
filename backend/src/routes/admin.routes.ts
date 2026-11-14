import { Router, Request, Response } from 'express';
import {
  getGatewaySettings,
  updateGatewaySettings,
  detectGatewayFromUrl,
  getTransactions,
  GatewayProvider,
} from '../services/settings.service';
import { verifyBoldAccountStatus } from '../services/bold-api.service';

const router = Router();

router.get('/settings', (_req: Request, res: Response) => {
  const settings = getGatewaySettings();
  const detectedInfo = detectGatewayFromUrl(settings.paymentUrl);
  const transactions = getTransactions();

  const totalGenerated = transactions.length;
  const approvedList = transactions.filter((t) => t.status === 'APPROVED');
  const totalApprovedAmount = approvedList.reduce((acc, t) => acc + (t.monto || 0), 0);
  const totalGeneratedAmount = transactions
    .filter((t) => t.status === 'GENERATED' || t.status === 'APPROVED')
    .reduce((acc, t) => acc + (t.monto || 0), 0);

  return res.json({
    ok: true,
    settings,
    detectedInfo,
    stats: {
      totalGenerated,
      totalApproved: approvedList.length,
      totalErrors: transactions.filter((t) => t.status === 'ERROR' || t.status === 'REJECTED').length,
      totalApprovedAmount,
      totalGeneratedAmount,
    },
    transactions: transactions.slice(0, 50),
  });
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
    const detectedInfo = detectGatewayFromUrl(updated.paymentUrl);

    return res.json({
      ok: true,
      settings: updated,
      detectedInfo,
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

export default router;

