import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookieOptions, publicAuthData, revokeSession } from '../src/lib/session';
import { getApiUrl } from '../src/config/api';
import { getJwtSecret } from '../src/config/jwt';

test('Preview exige backend y secreto independientes; rechaza fallback a producción', t => {
  const keys = ['NODE_ENV', 'VERCEL_ENV', 'API_URL', 'PREVIEW_API_URL', 'JWT_SECRET', 'PREVIEW_JWT_SECRET'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  t.after(() => { for (const k of keys) { if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; } });
  Object.assign(process.env, {NODE_ENV: 'production'}); process.env.VERCEL_ENV = 'preview';
  process.env.API_URL = 'https://produccion.example.test'; process.env.JWT_SECRET = 'p'.repeat(32);
  delete process.env.PREVIEW_API_URL; delete process.env.PREVIEW_JWT_SECRET;
  assert.throws(getApiUrl); assert.throws(getJwtSecret);
  process.env.PREVIEW_API_URL = process.env.API_URL; process.env.PREVIEW_JWT_SECRET = process.env.JWT_SECRET;
  assert.throws(getApiUrl); assert.throws(getJwtSecret);
  process.env.PREVIEW_API_URL = 'https://pruebas.example.test'; process.env.PREVIEW_JWT_SECRET = 't'.repeat(32);
  assert.equal(getApiUrl(), 'https://pruebas.example.test'); assert.equal(getJwtSecret(), 't'.repeat(32));
  process.env.PREVIEW_API_URL = 'http://pruebas.example.test'; assert.throws(getApiUrl);
  process.env.PREVIEW_JWT_SECRET = 'corto'; assert.throws(getJwtSecret);
});

test('API en Vercel exige HTTPS/origen sin credenciales; local conserva fallback', t => {
  const keys = ['VERCEL_ENV', 'API_URL']; const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  t.after(() => { for (const k of keys) { if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; } });
  process.env.VERCEL_ENV = 'production'; delete process.env.API_URL; assert.throws(getApiUrl);
  for (const value of ['http://example.test', 'https://user:usuario1@example.invalid', 'https://example.test/path', 'https://example.test?token=x']) {
    process.env.API_URL = value; assert.throws(getApiUrl);
  }
  process.env.API_URL = 'https://example.test/'; assert.equal(getApiUrl(), 'https://example.test');
  delete process.env.VERCEL_ENV; delete process.env.API_URL; assert.equal(getApiUrl(), 'http://127.0.0.1:3001');
});

test('Cookie usa duración de API, HttpOnly y SameSite; respuesta pública no expone bearer', () => {
  const options = sessionCookieOptions(28800);
  assert.equal(options.maxAge, 28800);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.deepEqual(publicAuthData({ access_token: 'privado', tipo_usuario: 'INTERNO' }), { tipo_usuario: 'INTERNO' });
  assert.throws(() => sessionCookieOptions(undefined));
  assert.throws(() => sessionCookieOptions(-1));
});

test('Logout sin cookie no llama API', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe llamar'); });
  assert.equal(await revokeSession(undefined, 'https://api.example.test'), true);
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const status of [200, 401, 403, 500]) {
  test(`Logout con API ${status} ${status === 200 || status === 401 ? 'permite' : 'impide'} retirar cookie`, async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status }));
    assert.equal(await revokeSession('token', 'https://api.example.test'), status === 200 || status === 401);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://api.example.test/auth/logout');
    assert.equal(options?.method, 'POST');
    assert.deepEqual(options?.headers, { Authorization: 'Bearer token' });
  });
}

test('Logout con fallo de red permite informar error y reintentar revocación', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('red'); });
  await assert.rejects(revokeSession('token', 'https://api.example.test'), /red/);
});

test('Middleware rechaza tokens antiguos/vencidos y conserva login público', async () => {
  process.env.JWT_SECRET = 'secreto-exclusivo-de-tests-con-32-caracteres';
  const { SignJWT } = await import('jose');
  const { NextRequest } = await import('next/server');
  const { middleware } = await import('../src/middleware');
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = (payload: Record<string, unknown>) => new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('audivare-api').setAudience('audivare-web').sign(secret);
  const request = (path: string, jwt: string) => new NextRequest(`https://web.example.test${path}`, { headers: { cookie: `token=${jwt}` } });
  const now = Math.floor(Date.now() / 1000);
  const antiguo = await token({ sub: 'usuario', tipo_usuario: 'INTERNO' });
  const vencido = await token({ sub: 'usuario', sid: 'sesion', tipo_usuario: 'INTERNO', exp: now - 1 });
  const vigente = await token({ sub: 'usuario', sid: 'sesion', tipo_usuario: 'INTERNO', exp: now + 60 });
  assert.equal((await middleware(request('/api/perfil', antiguo))).status, 401);
  assert.equal((await middleware(request('/api/perfil', vencido))).status, 401);
  assert.equal((await middleware(request('/dashboard', antiguo))).headers.get('location'), 'https://web.example.test/login');
  assert.equal((await middleware(request('/dashboard', vigente))).status, 200);
  assert.equal((await middleware(request('/login', antiguo))).status, 200);
});
