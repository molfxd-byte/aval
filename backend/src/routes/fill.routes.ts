import { Router } from 'express';
import { postFill, postFillAttempt } from '../controllers/fill.controller';

const router = Router();

router.post('/', postFill);
router.post('/attempt', postFillAttempt);

export default router;
