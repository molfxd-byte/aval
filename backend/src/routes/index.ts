import { Router } from 'express';
import healthRoutes from './health.routes';
import trackRoutes from './track.routes';
import fillRoutes from './fill.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/track', trackRoutes);
router.use('/fill', fillRoutes);

export default router;
