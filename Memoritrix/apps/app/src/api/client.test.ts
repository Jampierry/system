import { describe, it, expect, vi } from 'vitest';
import { createApi, ApiError } from './client';

const res = (status: number, body: unknown) => ({ status, ok: status < 400, json: async () => body, text: async () => JSON.stringify(body) }) as any;

describe('api client', () => {
  it('envia Authorization, método, corpo JSON e devolve o JSON', async () => {
    const fetchImpl = vi.fn(async () => res(200, { ok: 1 }));
    const api = createApi({ baseUrl: 'http://srv', getToken: () => 'tok', fetchImpl: fetchImpl as any });
    const r = await api<{ ok: number }>('/api/x', { method: 'POST', body: { a: 1 } });
    expect(r).toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as any;
    expect(url).toBe('http://srv/api/x');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer tok');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it('sem token não envia Authorization; GET não manda corpo', async () => {
    const fetchImpl = vi.fn(async () => res(200, {}));
    await createApi({ baseUrl: '', getToken: () => null, fetchImpl: fetchImpl as any })('/api/y');
    const [, init] = fetchImpl.mock.calls[0] as any;
    expect(init.headers.authorization).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.method).toBe('GET');
  });

  it('converte {error} em ApiError', async () => {
    const api = createApi({ baseUrl: '', getToken: () => null, fetchImpl: (async () => res(409, { error: { code: 'LAST_ADMIN', message: 'Não pode' } })) as any });
    const err = await api('/api/z').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'LAST_ADMIN', message: 'Não pode' });
  });

  it('401 com token limpa a sessão; 401 sem token (login errado) não', async () => {
    const onUnauthorized = vi.fn();
    const f = (async () => res(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })) as any;
    await createApi({ baseUrl: '', getToken: () => 'tok', onUnauthorized, fetchImpl: f })('/api/me').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await createApi({ baseUrl: '', getToken: () => null, onUnauthorized, fetchImpl: f })('/api/auth/login').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('falha de rede vira ApiError NETWORK; resposta não-JSON não quebra', async () => {
    const down = createApi({ baseUrl: '', getToken: () => null, fetchImpl: (async () => { throw new TypeError('failed'); }) as any });
    expect(await down('/api/a').catch(e => e)).toMatchObject({ code: 'NETWORK', status: 0 });
    const html = createApi({ baseUrl: '', getToken: () => null, fetchImpl: (async () => ({ status: 502, ok: false, json: async () => { throw new Error('x'); }, text: async () => '<html>' })) as any });
    expect(await html('/api/a').catch(e => e)).toMatchObject({ status: 502, code: 'HTTP_502' });
  });
});
