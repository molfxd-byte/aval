import { Request, Response } from 'express';
import { executeFillReal } from '../services/fill.service';

export async function postFill(req: Request, res: Response) {
  try {
    const { monto, banco, tipo, doc } = req.body ?? {};

    if (!monto || !banco || !tipo || !doc) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: monto, banco, tipo, doc',
      });
    }

    const cleanMonto = String(monto).replace(/\D/g, '');
    const cleanDoc = String(doc).replace(/\D/g, '');

    if (!cleanMonto) {
      return res.status(400).json({ error: 'Monto inválido' });
    }
    if (!cleanDoc) {
      return res.status(400).json({ error: 'Documento inválido' });
    }

    const result = await executeFillReal({
      monto: cleanMonto,
      banco: String(banco).trim(),
      tipo: String(tipo).trim(),
      doc: cleanDoc,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Error en /api/fill:', err);
    return res.status(500).json({
      error: err.message || 'Error al procesar la automatización de pago',
    });
  }
}

