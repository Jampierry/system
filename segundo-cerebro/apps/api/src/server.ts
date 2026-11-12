import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import type { Deps } from './deps';
import { HttpError } from './errors';
import { webFallback } from './static';
import { authRoutes } from './modules/auth/routes';
import { adminRoutes } from './modules/admin/routes';
import { recoveryRoutes } from './modules/recovery/routes';
import { itemRoutes } from './modules/items/routes';
import { noteRoutes } from './modules/notes/routes';
import { mindmapRoutes } from './modules/mindmaps/routes';
import { assistantRoutes } from './modules/assistant/routes';

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
}

export async function buildServer(deps: Deps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 15 * 1024 * 1024 });
  app.decorate('deps', deps);
  await app.register(cors, { origin: true });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: err.issues.map(i => i.message).join('; ') } });
    }
    if (err?.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    console.error(err);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Erro interno' } });
  });
  app.addHook('onRequest', async (_req, reply) => { reply.header('x-content-type-options', 'nosniff'); });
  app.setNotFoundHandler(webFallback(deps.cfg.webDir));

  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(recoveryRoutes);
  await app.register(itemRoutes);
  await app.register(noteRoutes);
  await app.register(mindmapRoutes);
  await app.register(assistantRoutes);
  return app;
}
