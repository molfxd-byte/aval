import { Router } from 'express';
import { postFill } from '../controllers/fill.controller';

const router = Router();

router.post('/', postFill);

export default router;

