import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api', routes);

// Producción: el mismo servicio sirve el frontend compilado (SPA).
const webDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(webDir));
app.get('*', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));

app.use(errorHandler);

export default app;
