import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeApp } from './test-utils';
import { loadConfig } from './config';

const dir = mkdtempSync(join(tmpdir(), 'cerebro-web-'));
mkdirSync(join(dir, '_expo/static/js'), { recursive: true });
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body><div id="root">SPA-MARKER</div></body></html>');
writeFileSync(join(dir, '_expo/static/js/app-abc123.js'), 'console.log("app")');
writeFileSync(join(dir, 'favicon.ico'), 'ico');
writeFileSync(join(dirname2(), 'segredo.txt'), 'não pode vazar');
function dirname2() { return mkdtempSync(join(tmpdir(), 'cerebro-secret-')); }
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const withWeb = () => makeApp({ cfg: { ...loadConfig({}), webDir: dir } });

describe('servidor estático + SPA', () => {
  it('GET / devolve o index.html sem cache', async () => {
    const { app } = await withWeb();
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.body).toContain('SPA-MARKER');
    expect(String(r.headers['cache-control'])).toContain('no-cache');
  });

  it('rotas do app (sem extensão) caem no index.html', async () => {
    const { app } = await withWeb();
    for (const url of ['/library/abc', '/admin/users', '/inbox?x=1']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(200);
      expect(r.body).toContain('SPA-MARKER');
    }
  });

  it('/api desconhecido → 404 JSON, nunca HTML; métodos não-GET também', async () => {
    const { app } = await withWeb();
    const r = await app.inject({ method: 'GET', url: '/api/inexistente' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toContain('application/json');
    expect(r.json().error.code).toBe('NOT_FOUND');
    const p = await app.inject({ method: 'POST', url: '/qualquer-coisa', payload: {} });
    expect(p.statusCode).toBe(404);
    expect(p.json().error.code).toBe('NOT_FOUND');
  });

  it('arquivos estáticos com tipo correto; assets com hash são cacheados para sempre', async () => {
    const { app } = await withWeb();
    const js = await app.inject({ method: 'GET', url: '/_expo/static/js/app-abc123.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toContain('javascript');
    expect(String(js.headers['cache-control'])).toContain('immutable');
    expect((await app.inject({ method: 'GET', url: '/favicon.ico' })).statusCode).toBe(200);
  });

  it('arquivo com extensão que não existe → 404 (não devolve o index.html)', async () => {
    const { app } = await withWeb();
    const r = await app.inject({ method: 'GET', url: '/sumiu.js' });
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toContain('SPA-MARKER');
  });

  it('não vaza arquivos fora da pasta (path traversal)', async () => {
    const { app } = await withWeb();
    for (const url of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/..%2f..%2fetc%2fpasswd', '/_expo/../../etc/passwd']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.body, url).not.toContain('não pode vazar');
      expect(r.body, url).not.toContain('root:');
    }
  });

  it('a API continua funcionando junto e envia nosniff', async () => {
    const { app } = await withWeb();
    const r = await app.inject({ method: 'GET', url: '/api/auth/setup-status' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ needsSetup: true });
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sem webDir, / é 404 JSON', async () => {
    const { app } = await makeApp();
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('NOT_FOUND');
  });
});
