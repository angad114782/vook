import { Router } from 'express';
import { accessSnapshot } from '../../domain/access.ts';
import { me, ok } from '../../lib/http.ts';

export const accessRouter = Router();
accessRouter.get('/access', async (req, res) => ok(res, await accessSnapshot(me(req))));
