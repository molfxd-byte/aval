import { Request, Response } from 'express';

export function getHealth(_req: Request, res: Response) {
  res.json({ ok: true, data: { status: 'up', timestamp: new Date().toISOString() } });
}
