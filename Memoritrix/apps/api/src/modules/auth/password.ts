import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEYLEN = 64;
const OPTS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function derive(pw: string, salt: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => scrypt(pw, salt, KEYLEN, OPTS, (e, k) => (e ? rej(e) : res(k))));
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, h] = stored.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const expected = Buffer.from(h, 'base64');
  const key = await derive(pw, Buffer.from(s, 'base64'));
  return key.length === expected.length && timingSafeEqual(key, expected);
}
