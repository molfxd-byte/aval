import app from './app';
import { env } from './config/env';
import { sendStartupHeartbeat } from './services/telemetry.service';

app.listen(env.port, () => {
  console.log(`Servidor corriendo en http://localhost:${env.port}`);
  sendStartupHeartbeat().catch(() => {});
});
