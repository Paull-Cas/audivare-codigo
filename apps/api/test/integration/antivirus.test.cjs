const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Readable } = require('node:stream');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
process.env.JWT_SECRET = 'secreto-ficticio-exclusivo-de-integracion';
delete process.env.ANTIVIRUS_MODE;
const { db, client, archivoAnalisis, usuario, superadminPermiso, empresa, documentoEmpresa } = require('@audivare/database');
const { eq } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { StorageService } = require('../../dist/storage/storage.service');
const { AnalisisArchivosService } = require('../../dist/storage/analisis-archivos.service');
const png = readFileSync(path.join(__dirname, '../fixtures/adjunto.png'));
const limpio = { estado: 'LIMPIO', motivo: 'ANALIZADO', motor: 'Simulado para integración' };
const infectado = { estado: 'CUARENTENA', motivo: 'DETECCION_ANTIVIRUS', motor: 'Simulado para integración' };
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
function caso(t) {
  const bucket = `test-${randomUUID()}`, key = `empresa/${randomUUID()}.png`;
  const analysis = new AnalisisArchivosService(); analysis.enabled = true; analysis.resultado = infectado;
  let scans = 0, deletes = 0, urls = 0;
  analysis.analizarBuffer = async buffer => { scans++; assert.deepEqual(buffer, png); return analysis.resultado; };
  const storage = Object.create(StorageService.prototype); storage.analisis = analysis; storage.bucketName = bucket;
  storage.minioClient = { statObject: async () => ({ size: png.length, etag: 'etag-ficticio' }),
    getObject: async () => Readable.from(png), presignedGetObject: async () => { urls++; return 'url-ficticia'; },
    removeObject: async () => { deletes++; } };
  t.after(() => db.delete(archivoAnalisis).where(eq(archivoAnalisis.bucket, bucket)));
  return { bucket, key, analysis, storage, scans: () => scans, deletes: () => deletes, urls: () => urls };
}

test('Cuarentena durable conserva referencia y original, sobrevive a nueva instancia y se recupera con reanálisis', async t => {
  const c = caso(t), eid = randomUUID();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test` });
  t.after(() => db.delete(empresa).where(eq(empresa.id, eid)));
  await db.insert(documentoEmpresa).values({ empresaId: eid, titulo: 'Ficticio', archivoStoragePath: c.key, archivoNombreOriginal: 'ficticio.png' });
  await assert.rejects(c.storage.getPresignedUrl(c.key), e => e.getStatus() === 403);
  const row = await new AnalisisArchivosService().obtener(c.bucket, c.key);
  assert.equal(row.estado, 'CUARENTENA'); assert.equal(row.sha256, createHash('sha256').update(png).digest('hex'));
  assert.equal(row.etag, 'etag-ficticio'); assert.ok(row.analizadoEn instanceof Date);
  assert.equal((await db.select().from(documentoEmpresa).where(eq(documentoEmpresa.empresaId, eid)))[0].archivoStoragePath, c.key);
  c.analysis.resultado = limpio;
  await assert.rejects(c.storage.getObjectStream(c.key), e => e.getStatus() === 403); assert.equal(c.scans(), 1);
  await c.storage.reanalizarObjeto(c.key);
  assert.equal((await c.analysis.listar(c.bucket)).length, 1);
  assert.equal((await c.analysis.obtener(c.bucket, c.key)).estado, 'LIMPIO');
  assert.equal(await c.storage.getPresignedUrl(c.key), 'url-ficticia'); assert.equal(c.deletes(), 0);
});
test('ERROR se persiste y reintenta sin autorizar por un resultado limpio viejo', async t => {
  const c = caso(t); c.analysis.resultado = { estado: 'ERROR', motivo: 'ESCANER_NO_DISPONIBLE' };
  await assert.rejects(c.storage.getPresignedUrl(c.key), e => e.getStatus() === 503);
  assert.equal((await c.analysis.obtener(c.bucket, c.key)).estado, 'ERROR'); assert.equal(c.urls(), 0);
  c.analysis.resultado = limpio; await c.storage.getPresignedUrl(c.key);
  c.analysis.resultado = infectado; await assert.rejects(c.storage.getPresignedUrl(c.key), e => e.getStatus() === 403);
  assert.equal((await c.analysis.obtener(c.bucket, c.key)).estado, 'CUARENTENA'); assert.equal(c.urls(), 1);
});
test('Análisis de misma ruta en otro bucket no desbloquea cuarentena', async t => {
  const c = caso(t), other = `test-${randomUUID()}`;
  t.after(() => db.delete(archivoAnalisis).where(eq(archivoAnalisis.bucket, other)));
  await c.analysis.registrar(c.bucket, c.key, infectado, png, 'v1');
  await c.analysis.registrar(other, c.key, limpio, png, 'v2');
  await assert.rejects(c.storage.getPresignedUrl(c.key), e => e.getStatus() === 403); assert.equal(c.scans(), 0);
});
test('HTTP real: sesión, rol y permiso desde BD; reanálisis limitado al bucket configurado', async t => {
  const c = caso(t); await c.analysis.registrar(c.bucket, c.key, infectado, png, 'v1');
  const row = await c.analysis.obtener(c.bucket, c.key);
  const { Module } = require('@nestjs/common'), { NestFactory } = require('@nestjs/core'), { FastifyAdapter } = require('@nestjs/platform-fastify');
  const { JwtService } = require('@nestjs/jwt'), { SesionesService } = require('../../dist/auth/sesiones.service');
  const { PermisosService } = require('../../dist/common/permisos/permisos.service'), { JwtStrategy } = require('../../dist/auth/jwt.strategy');
  const { JwtAuthGuard } = require('../../dist/auth/jwt-auth.guard'), { SuperadminGuard } = require('../../dist/auth/superadmin.guard');
  const { SuperadminPermisoGuard } = require('../../dist/superadmin/superadmin-permiso.guard');
  const { AnalisisArchivosController } = require('../../dist/storage/analisis-archivos.controller');
  const sessions = new SesionesService(new JwtService({ secret: process.env.JWT_SECRET }), new PermisosService());
  class TestModule {}
  Module({ controllers: [AnalisisArchivosController], providers: [
    { provide: AnalisisArchivosService, useValue: c.analysis }, { provide: StorageService, useValue: c.storage },
    { provide: JwtStrategy, useValue: new JwtStrategy(sessions) }, JwtAuthGuard, SuperadminGuard, SuperadminPermisoGuard] })(TestModule);
  const app = await NestFactory.create(TestModule, new FastifyAdapter(), { logger: false }); t.after(() => app.close()); await app.init();
  const http = app.getHttpAdapter().getInstance();
  const request = (token, id) => http.inject({ method: id ? 'POST' : 'GET', url: '/superadmin/storage/analisis' + (id ? `/${id}/reanalizar` : ''),
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal((await request()).statusCode, 401);
  for (const tipoUsuario of ['CONTADOR_EXTERNO', 'SUPERADMIN']) {
    const [user] = await db.insert(usuario).values({ email: `${randomUUID()}@example.test`, tipoUsuario }).returning();
    t.after(() => db.delete(usuario).where(eq(usuario.id, user.id)));
    const token = (await sessions.crear(user)).access_token;
    assert.equal((await request(token)).statusCode, 403);
    assert.equal((await request(token, row.id)).statusCode, 403);
    if (tipoUsuario === 'SUPERADMIN') {
      await db.insert(superadminPermiso).values({ usuarioId: user.id, codigoPermiso: 'SA_EMPRESA_MANAGE' });
      assert.equal((await request(token)).statusCode, 200);
      assert.equal((await request(token, row.id)).statusCode, 403); // Sin permitir forzar aprobación.
      assert.equal((await request(token, 'invalido')).statusCode, 400);
      const other = `test-${randomUUID()}`; t.after(() => db.delete(archivoAnalisis).where(eq(archivoAnalisis.bucket, other)));
      await c.analysis.registrar(other, c.key, limpio, png, 'v2');
      assert.equal((await request(token, (await c.analysis.obtener(other, c.key)).id)).statusCode, 404);
      c.analysis.resultado = limpio; assert.equal((await request(token, row.id)).statusCode, 201);
      await db.delete(superadminPermiso).where(eq(superadminPermiso.usuarioId, user.id));
      assert.equal((await request(token)).statusCode, 403); // Revocación con la misma sesión.
    }
  }
});
