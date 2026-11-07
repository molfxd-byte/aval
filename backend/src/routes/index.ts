import { Router } from 'express';
import healthRoutes from './health.routes';
import trackRoutes from './track.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/track', trackRoutes);

export default router;
