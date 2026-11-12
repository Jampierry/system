import { createReadStream, statSync, existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

/** Caminho absoluto de um arquivo dentro de `root`, ou null se for inseguro/inexistente. */
export function resolveSafe(root: string, urlPath: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const base = resolve(root);
  const file = resolve(join(base, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded)));
  if (file !== base && !file.startsWith(base + sep)) return null;
  try { return statSync(file).isFile() ? file : null; } catch { return null; }
}

const immutable = (urlPath: string) => urlPath.startsWith('/_expo/static/') || urlPath.startsWith('/assets/');

function sendFile(reply: FastifyReply, file: string, cache: string) {
  return reply
    .header('content-type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
    .header('cache-control', cache)
    .send(createReadStream(file));
}

/**
 * Trata o que nenhuma rota casou: arquivos do app web exportado e, para rotas do app (sem extensão),
 * o index.html (SPA). Tudo que é /api ou não-GET segue como 404 JSON.
 */
export function webFallback(webDir: string | undefined) {
  const notFound = (reply: FastifyReply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } });
  return (req: FastifyRequest, reply: FastifyReply) => {
    const urlPath = req.url.split('?')[0];
    if (!webDir || (req.method !== 'GET' && req.method !== 'HEAD') || urlPath === '/api' || urlPath.startsWith('/api/')) return notFound(reply);
    const file = resolveSafe(webDir, urlPath);
    if (file) return sendFile(reply, file, immutable(urlPath) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (/\.[A-Za-z0-9]{1,8}$/.test(urlPath)) return notFound(reply); // arquivo que não existe
    const index = join(webDir, 'index.html');
    return existsSync(index) ? sendFile(reply, index, 'no-cache') : notFound(reply);
  };
}
