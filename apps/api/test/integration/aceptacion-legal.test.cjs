const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
process.env.JWT_SECRET = 'secreto-ficticio-exclusivo-de-aceptacion-legal';
const { db, client, usuario, empresa, documentoLegal, aceptacionLegal, sesion } = require('@audivare/database');
const { eq, sql } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../../dist/auth/auth.service');
const { SesionesService } = require('../../dist/auth/sesiones.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const legal = require('../../dist/auth/aceptacion-legal');
const permisos = new PermisosService();
const sesiones = new SesionesService(new JwtService({ secret: process.env.JWT_SECRET }), permisos);
const aceptada = () => ({ acepta_terminos: true, privacidad_leida: true, version_legal: legal.VERSION_LEGAL });
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
async function actor(t) {
  const [u] = await db.insert(usuario).values({ email: randomUUID() + '@example.test', nombreCompleto: 'Cuenta ficticia', tipoUsuario: 'CONTADOR_EXTERNO' }).returning();
  t.after(() => db.delete(usuario).where(eq(usuario.id, u.id)));
  return u;
}

test('Rechaza omisión, falso, texto booleano y versión antigua antes de verificar Google', async () => {
  const auth = new AuthService(sesiones, {}, permisos); let llamadas = 0;
  auth.verificarCredencialGoogle = async () => { llamadas++; throw Error('No debe llamarse'); };
  for (const body of [{}, { ...aceptada(), acepta_terminos: false }, { ...aceptada(), acepta_terminos: 'true' },
    { ...aceptada(), privacidad_leida: false }, { ...aceptada(), version_legal: 'anterior' },
    { ...aceptada(), tipo: 'EMPRESA', declara_representacion: false }]) {
    await assert.rejects(auth.googleRegistro(body), e => [400, 403, 409].includes(e.getStatus()));
  }
  assert.equal(llamadas, 0);
});

test('Registro de empresa y aceptación son atómicos, con texto y representación verificables', async t => {
  const email = randomUUID() + '@example.test';
  const auth = new AuthService(sesiones, { crearNotificacion: async () => {} }, permisos);
  auth.verificarCredencialGoogle = async () => ({ email, nombre: 'Representante ficticio' });
  await auth.googleRegistro({ ...aceptada(), declara_representacion: true, tipo: 'EMPRESA', credential: 'fixture',
    nombre_completo: 'Representante ficticio', ruc: '20' + String(Date.now()).slice(-9), razon_social: 'Empresa de ensayo legal' });
  const [u] = await db.select().from(usuario).where(eq(usuario.email, email));
  const [emp] = await db.select().from(empresa).where(eq(empresa.emailRegistro, email));
  t.after(async () => { await db.delete(empresa).where(eq(empresa.id, emp.id)); await db.delete(usuario).where(eq(usuario.id, u.id)); });
  const [aceptacion] = await db.select().from(aceptacionLegal).where(eq(aceptacionLegal.usuarioId, u.id));
  const [documento] = await db.select().from(documentoLegal).where(eq(documentoLegal.id, aceptacion.documentoId));
  assert.equal(aceptacion.empresaId, emp.id); assert.equal(aceptacion.representaEmpresa, true);
  assert.equal(aceptacion.origen, 'REGISTRO'); assert.ok(aceptacion.aceptadaEn instanceof Date);
  assert.equal(documento.contenido, legal.CONTENIDO_LEGAL);
  assert.equal(createHash('sha256').update(documento.contenido).digest('hex'), documento.sha256);
  assert.ok((await legal.estadoAceptacionLegal(u.id)).aceptada_en);
});

test('Un fallo posterior revierte también la aceptación, usuario y empresa', async () => {
  const email = randomUUID() + '@example.test';
  const auth = new AuthService({ crear: async () => { throw Error('firma fallida'); } }, {}, permisos);
  auth.verificarCredencialGoogle = async () => ({ email, nombre: 'Ficticio' });
  const antes = await db.select().from(aceptacionLegal);
  await assert.rejects(auth.googleRegistro({ ...aceptada(), tipo: 'CONTADOR', nombre_completo: 'Ficticio', credential: 'fixture' }), /firma fallida/);
  assert.equal((await db.select().from(usuario).where(eq(usuario.email, email))).length, 0);
  assert.equal((await db.select().from(aceptacionLegal)).length, antes.length);
});

test('Reintentos concurrentes conservan una aceptación y su fecha original', async t => {
  const u = await actor(t);
  assert.equal((await legal.estadoAceptacionLegal(u.id)).aceptada_en, null);
  const resultados = await Promise.all(Array.from({ length: 4 }, () => db.transaction(tx => legal.registrarAceptacionLegal(tx, u.id, null, 'REVISION'))));
  assert.equal((await db.select().from(aceptacionLegal).where(eq(aceptacionLegal.usuarioId, u.id))).length, 1);
  assert.equal(new Set(resultados.map(r => r.aceptada_en.toISOString())).size, 1);
  assert.equal(resultados[0].representa_empresa, false);
});

test('No permite reescribir textos ni fechas, borrar evidencia reciente o truncarla', async t => {
  const u = await actor(t);
  await db.transaction(tx => legal.registrarAceptacionLegal(tx, u.id, null, 'REVISION'));
  const [r] = await db.select().from(aceptacionLegal).where(eq(aceptacionLegal.usuarioId, u.id));
  await assert.rejects(db.update(aceptacionLegal).set({ aceptadaEn: new Date('2000-01-01') }).where(eq(aceptacionLegal.id, r.id)));
  await assert.rejects(db.delete(aceptacionLegal).where(eq(aceptacionLegal.id, r.id)));
  await assert.rejects(db.execute(sql`TRUNCATE aceptacion_legal`));
  await assert.rejects(db.update(documentoLegal).set({ contenido: 'sustituido' }).where(eq(documentoLegal.id, r.documentoId)));
  await assert.rejects(db.delete(documentoLegal).where(eq(documentoLegal.id, r.documentoId)));
  assert.ok((await legal.estadoAceptacionLegal(u.id)).aceptada_en);
});

test('HTTP requiere sesión real e ignora identidad/empresa/versiones falsificadas del cuerpo', async t => {
  require('reflect-metadata');
  const { Module } = require('@nestjs/common'), { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify');
  const { JwtStrategy } = require('../../dist/auth/jwt.strategy');
  const { JwtAuthGuard } = require('../../dist/auth/jwt-auth.guard');
  const { LegalController } = require('../../dist/auth/legal.controller');
  class Ensayo {}
  Module({ controllers: [LegalController], providers: [{ provide: JwtStrategy, useValue: new JwtStrategy(sesiones) }, JwtAuthGuard] })(Ensayo);
  const app = await NestFactory.create(Ensayo, new FastifyAdapter(), { logger: false });
  t.after(() => app.close()); await app.init();
  const http = app.getHttpAdapter().getInstance(); const u = await actor(t), otro = await actor(t);
  const token = (await sesiones.crear(u)).access_token;
  const headers = { authorization: 'Bearer ' + token };
  assert.equal((await http.inject({ method: 'POST', url: '/legal/aceptacion', payload: aceptada() })).statusCode, 401);
  assert.equal((await http.inject({ method: 'POST', url: '/legal/aceptacion', headers, payload: { ...aceptada(), version_legal: 'anterior' } })).statusCode, 409);
  assert.equal((await http.inject({ method: 'POST', url: '/legal/aceptacion', headers,
    payload: { ...aceptada(), usuario_id: otro.id, empresa_id: randomUUID(), declara_representacion: true } })).statusCode, 201);
  assert.ok((await legal.estadoAceptacionLegal(u.id)).aceptada_en);
  assert.equal((await legal.estadoAceptacionLegal(otro.id)).aceptada_en, null);
  assert.equal((await legal.estadoAceptacionLegal(u.id)).representa_empresa, false);
  await db.delete(sesion).where(eq(sesion.usuarioId, u.id));
  assert.equal((await http.inject({ url: '/legal/aceptacion', headers })).statusCode, 401);
});
