const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/audivare_test';
process.env.JWT_SECRET = 'secreto-exclusivo-de-tests-con-32-caracteres';
const { JwtService } = require('@nestjs/jwt');
const { PgDialect } = require('drizzle-orm/pg-core');
const { db } = require('@audivare/database');
const { SesionesService, DURACION_SESION_SEGUNDOS, JWT_ISSUER, JWT_AUDIENCE } = require('../dist/auth/sesiones.service');
const { JwtStrategy } = require('../dist/auth/jwt.strategy');
const { AuthService } = require('../dist/auth/auth.service');

const user = { id: randomUUID(), email: 'usuario1@example.invalid', tipoUsuario: 'CONTADOR_EXTERNO', nombreCompleto: 'Prueba' };
const dialect = new PgDialect();

function caso(t) {
  const usuarios = new Map([[user.id, { ...user }]]);
  const sesiones = new Map();
  const params = (condition) => dialect.sqlToQuery(condition).params;
  t.mock.method(db, 'insert', () => ({ values: (data) => ({ returning: async () => {
    const id = randomUUID();
    sesiones.set(id, { ...data, id });
    return [{ id }];
  } }) }));
  const consultar = t.mock.method(db, 'select', () => ({ from: () => ({ innerJoin: () => ({ where: async (condition) => {
    const [sid, uid, ahora] = params(condition);
    const session = sesiones.get(sid);
    const actual = usuarios.get(uid);
    return session && actual && session.usuarioId === uid && session.fechaExpiracion > new Date(ahora) ? [actual] : [];
  } }) }) }));
  t.mock.method(db, 'delete', () => ({ where: async (condition) => {
    const [sid, uid] = params(condition);
    if (sesiones.get(sid)?.usuarioId === uid) sesiones.delete(sid);
  } }));
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const permisos = { getEmpresaId: async () => randomUUID() };
  const service = new SesionesService(jwt, permisos);
  const autenticar = (token) => new Promise((resolve, reject) => {
    const strategy = new JwtStrategy(service);
    strategy.success = resolve;
    strategy.fail = (error) => reject(error instanceof Error ? error : new Error('No autorizado'));
    strategy.error = reject;
    strategy.authenticate({ headers: { authorization: `Bearer ${token}` } });
  });
  const firmar = (payload, options = {}) => jwt.signAsync(payload, {
    algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, ...options,
  });
  return { service, jwt, usuarios, sesiones, permisos, consultar, autenticar, firmar };
}

test('Emite sesión de ocho horas y acepta su token mediante Passport real', async (t) => {
  const c = caso(t);
  const result = await c.service.crear(user);
  const payload = c.jwt.decode(result.access_token);
  assert.equal(payload.exp - payload.iat, DURACION_SESION_SEGUNDOS);
  assert.equal(result.expires_in, 28800);
  assert.equal(payload.iss, JWT_ISSUER);
  assert.equal(payload.aud, JWT_AUDIENCE);
  assert.equal(c.sesiones.get(payload.sid).fechaExpiracion.getTime(), payload.exp * 1000);
  assert.deepEqual(await c.autenticar(result.access_token), {
    id: user.id, email: user.email, tipo_usuario: user.tipoUsuario, session_id: payload.sid,
  });
});

test('Cerrar sesión revoca copias del token, mantiene otros dispositivos y es idempotente', async (t) => {
  const c = caso(t);
  const primera = await c.service.crear(user);
  const segunda = await c.service.crear(user);
  await c.service.revocarToken(primera.access_token);
  await c.service.revocarToken(primera.access_token);
  await assert.rejects(c.autenticar(primera.access_token), /ya no está vigente/);
  assert.equal((await c.autenticar(segunda.access_token)).id, user.id);
  assert.equal(c.sesiones.size, 1);
});

test('Al alcanzar exp, Passport rechaza antes de consultar BD', async (t) => {
  const c = caso(t);
  const token = await c.firmar({ sub: user.id, sid: randomUUID(), tipo_usuario: user.tipoUsuario, exp: Math.floor(Date.now() / 1000) });
  await assert.rejects(c.autenticar(token), /expired/);
  assert.equal(c.consultar.mock.callCount(), 0);
});

for (const campo of ['exp', 'sid']) {
  test(`Rechaza token antiguo sin ${campo}, aunque esté firmado`, async (t) => {
    const c = caso(t);
    const payload = { sub: user.id, sid: randomUUID(), tipo_usuario: user.tipoUsuario, exp: Math.floor(Date.now() / 1000) + 60 };
    delete payload[campo];
    await assert.rejects(c.autenticar(await c.firmar(payload)), /sesión venció/);
    assert.equal(c.consultar.mock.callCount(), 0);
  });
}

for (const [nombre, options] of [
  ['emisor incorrecto', { issuer: 'otro' }],
  ['audiencia incorrecta', { audience: 'otra' }],
  ['algoritmo incorrecto', { algorithm: 'HS512' }],
]) {
  test(`Rechaza ${nombre}`, async (t) => {
    const c = caso(t);
    const payload = { sub: user.id, sid: randomUUID(), tipo_usuario: user.tipoUsuario, exp: Math.floor(Date.now() / 1000) + 60 };
    await assert.rejects(c.autenticar(await c.firmar(payload, options)));
    assert.equal(c.consultar.mock.callCount(), 0);
  });
}

test('Rechaza firma alterada y no revoca otras sesiones', async (t) => {
  const c = caso(t);
  const result = await c.service.crear(user);
  const partes = result.access_token.split('.');
  partes[2] = `${partes[2][0] === 'a' ? 'b' : 'a'}${partes[2].slice(1)}`;
  const alterado = partes.join('.');
  await assert.rejects(c.autenticar(alterado), /signature/);
  await assert.rejects(c.service.revocarToken(alterado), /inválida/);
  assert.equal(c.sesiones.size, 1);
});

test('Expiración de BD invalida token aun si su exp criptográfico está vigente', async (t) => {
  const c = caso(t);
  const result = await c.service.crear(user);
  c.sesiones.get(c.jwt.decode(result.access_token).sid).fechaExpiracion = new Date(0);
  await assert.rejects(c.autenticar(result.access_token), /ya no está vigente/);
});

for (const cambio of ['eliminar', 'cambiar tipo']) {
  test(`Rechaza sesión al ${cambio} del usuario`, async (t) => {
    const c = caso(t);
    const result = await c.service.crear(user);
    if (cambio === 'eliminar') c.usuarios.delete(user.id);
    else c.usuarios.get(user.id).tipoUsuario = 'SUPERADMIN';
    await assert.rejects(c.autenticar(result.access_token), /ya no está vigente/);
  });
}

test('Usuario interno desactivado no opera, pero sí puede revocar su sesión', async (t) => {
  const c = caso(t);
  const interno = { ...user, tipoUsuario: 'INTERNO' };
  c.usuarios.set(user.id, interno);
  const result = await c.service.crear(interno);
  c.permisos.getEmpresaId = async () => { throw new Error('Usuario inactivo o empresa suspendida'); };
  await assert.rejects(c.autenticar(result.access_token), /inactivo/);
  await c.service.revocarToken(result.access_token);
  assert.equal(c.sesiones.size, 0);
});

test('Login existente entrega una sesión persistida sin cambiar identidad o permisos', async (t) => {
  const c = caso(t);
  t.mock.method(db, 'select', () => ({ from: () => ({ where: async () => [user] }) }));
  const auth = new AuthService(c.service, {}, {});
  const result = await auth.login(user.email, null, true);
  assert.equal(c.sesiones.size, 1);
  assert.equal(c.jwt.decode(result.access_token).sub, user.id);
  assert.equal(result.tipo_usuario, user.tipoUsuario);
});
