import { Router } from 'express';
import { postTrack } from '../controllers/track.controller';

const router = Router();
router.post('/', postTrack);

export default router;
