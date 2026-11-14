import express, { Router } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authenticate } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render đặt app sau proxy
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const api = Router();
  // Công khai: chỉ đăng nhập
  api.use(authRoutes);
  // Mọi API còn lại cần token (NFR-05)
  api.use(authenticate);
  api.use(notFoundHandler);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
