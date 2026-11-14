import { Router } from 'express';
import healthRoutes from './health.routes';
import trackRoutes from './track.routes';
import fillRoutes from './fill.routes';
import webhookRoutes from './webhook.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/track', trackRoutes);
router.use('/fill', fillRoutes);
router.use('/webhook', webhookRoutes);
router.use('/admin', adminRoutes);

export default router;
