const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
process.env.JWT_SECRET = 'secreto-ficticio-exclusivo-de-integracion';
const { db, client, empresa, usuario, documentoEmpresa, documentoSustento, pagoFactura, factura, storageRevision, superadminPermiso } = require('@audivare/database');
const { eq } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { ReconciliacionService } = require('../../dist/storage/reconciliacion.service');
const { StorageService } = require('../../dist/storage/storage.service');
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
function caso(t) {
  const bucket = `test-${randomUUID()}`, paths = new Set(), borrados = [];
  const storage = { getBucketName: () => bucket, listObjectInventory: async () => [...paths],
    removeObjectForReconciliation: async key => { borrados.push(key); paths.delete(key); } };
  const service = new ReconciliacionService(storage);
  t.after(() => db.delete(storageRevision).where(eq(storageRevision.bucket, bucket)));
  const key = () => `facturas/${randomUUID()}/${randomUUID()}.pdf`;
  const pendiente = async (objectPath, motivo = 'LIMPIEZA_FALLIDA', patch = {}) => {
    const [row] = await db.insert(storageRevision).values({ bucket, objectPath, motivo,
      primeraDeteccion: new Date(Date.now() - 8 * 86400000), proximoIntento: new Date(Date.now() - 1000), intentos: 1, ...patch }).returning();
    return row;
  };
  return { bucket, paths, borrados, storage, service, key, pendiente };
}
async function referencia(t, key, tipo = 'empresa') {
  const eid = randomUUID(), fid = randomUUID();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test` });
  t.after(() => db.delete(empresa).where(eq(empresa.id, eid)));
  if (tipo === 'empresa') await db.insert(documentoEmpresa).values({ empresaId: eid, titulo: 'Ficticio', archivoStoragePath: key, archivoNombreOriginal: 'ficticio.pdf' });
  else {
    await db.insert(factura).values({ id: fid, empresaId: eid });
    if (tipo === 'documento') await db.insert(documentoSustento).values({ facturaId: fid, tipoDocumento: 'OTROS', archivoStoragePath: key, archivoNombreOriginal: 'ficticio.pdf' });
    else await db.insert(pagoFactura).values({ facturaId: fid, montoPagado: '1.00', comprobantePath: key });
  }
}
test('Conciliación registra huérfano/faltante; desconocidos y objetos vivos no se borran', async t => {
  const c = caso(t), huerfano = c.key(), faltante = c.key(), vivo = c.key();
  c.paths.add(huerfano); c.paths.add(vivo); c.paths.add('carpeta-ajena/objeto');
  await referencia(t, faltante); await referencia(t, vivo);
  const result = await c.service.conciliar();
  assert.ok(result.sin_referencia.includes(huerfano)); assert.ok(result.referencias_faltantes.includes(faltante));
  assert.ok(result.no_gestionados.includes('carpeta-ajena/objeto')); assert.equal(c.borrados.length, 0);
  const tasks = await c.service.listar(); assert.equal(tasks.length, 2);
  await assert.rejects(c.service.reintentar(tasks.find(x => x.objectPath === huerfano).id), /requiere revisión/);
});
test('Inventario interrumpido revierte la conciliación; repetir no duplica tarea ni reinicia retención', async t => {
  const c = caso(t), key = c.key(); c.paths.add(key);
  await c.service.conciliar(); const [old] = await c.service.listar();
  c.storage.listObjectInventory = async () => { throw new Error('inventario interrumpido'); };
  await assert.rejects(c.service.conciliar(), /interrumpido/);
  c.storage.listObjectInventory = async () => [...c.paths];
  await c.service.conciliar(); const tasks = await c.service.listar();
  assert.equal(tasks.length, 1); assert.equal(tasks[0].primeraDeteccion.getTime(), old.primeraDeteccion.getTime());
});
for (const tipo of ['empresa', 'documento', 'pago']) test(`Reintento conserva archivo referenciado por ${tipo}`, async t => {
  const c = caso(t), key = c.key(); c.paths.add(key); await referencia(t, key, tipo);
  const task = await c.pendiente(key);
  assert.equal((await c.service.reintentar(task.id)).estado, 'PROTEGIDO'); assert.equal(c.borrados.length, 0);
});
test('Retención/límite/bucket equivocado impiden borrar', async t => {
  const c = caso(t), a = await c.pendiente(c.key(), 'LIMPIEZA_FALLIDA', { proximoIntento: new Date(Date.now() + 7 * 86400000) });
  await assert.rejects(c.service.reintentar('-'.repeat(36)), /Identificador inválido/);
  await assert.rejects(c.service.reintentar(a.id), /Retención/);
  const b = await c.pendiente(c.key(), 'LIMPIEZA_FALLIDA', { intentos: 10 });
  await assert.rejects(c.service.reintentar(b.id), /límite/);
  const otra = new ReconciliacionService({ ...c.storage, getBucketName: () => 'otro-bucket' });
  await assert.rejects(otra.reintentar(a.id), /no encontrada/); assert.equal(c.borrados.length, 0);
});

test('Borrado de sustento conserva archivo y fila si falla el historial en la transacción', async t => {
  const c = caso(t), eid = randomUUID(), fid = randomUUID(), did = randomUUID(), key = c.key();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test` });
  t.after(() => db.delete(empresa).where(eq(empresa.id, eid)));
  await db.insert(factura).values({ id: fid, empresaId: eid });
  await db.insert(documentoSustento).values({ id: did, facturaId: fid, tipoDocumento: 'OTROS', archivoStoragePath: key, archivoNombreOriginal: 'ficticio.pdf' });
  const { FacturasService } = require('../../dist/facturas/facturas.service');
  let llamadas = 0;
  const service = new FacturasService({ deleteFile: async () => llamadas++ }, {}, {});
  service.autorizarFactura = async () => ({ empresaId: eid }); // Aislar orden BD/storage; permisos se prueban por separado.
  await assert.rejects(service.deleteDocumento({ userId: randomUUID() }, fid, did)); // FK usuario del historial inválida.
  assert.equal(llamadas, 0);
  assert.equal((await db.select().from(documentoSustento).where(eq(documentoSustento.id, did))).length, 1);
});

test('Borrado de sustento confirma BD antes de limpiar; fallo storage no revierte el documento', async t => {
  const c = caso(t), eid = randomUUID(), fid = randomUUID(), did = randomUUID(), key = c.key();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test` });
  t.after(() => db.delete(empresa).where(eq(empresa.id, eid)));
  const [user] = await db.insert(usuario).values({ email: `${randomUUID()}@example.test`, tipoUsuario: 'CONTADOR_EXTERNO' }).returning();
  t.after(() => db.delete(usuario).where(eq(usuario.id, user.id)));
  await db.insert(factura).values({ id: fid, empresaId: eid });
  await db.insert(documentoSustento).values({ id: did, facturaId: fid, tipoDocumento: 'OTROS', archivoStoragePath: key, archivoNombreOriginal: 'ficticio.pdf' });
  const { FacturasService } = require('../../dist/facturas/facturas.service');
  let llamadas = 0;
  const service = new FacturasService({ deleteFile: async p => {
    llamadas++; assert.equal(p, key);
    assert.equal((await db.select().from(documentoSustento).where(eq(documentoSustento.id, did))).length, 0);
    throw new Error('storage caído');
  } }, {}, {});
  service.autorizarFactura = async () => ({ empresaId: eid });
  service.logger = { warn() {} };
  assert.match((await service.deleteDocumento({ userId: user.id }, fid, did)).message, /exitosamente/);
  assert.equal(llamadas, 1);
});

test('Borrado de documento de empresa confirma BD y registra limpieza fallida durable', async t => {
  const c = caso(t), eid = randomUUID(), did = randomUUID(), key = c.key();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test` });
  t.after(() => db.delete(empresa).where(eq(empresa.id, eid)));
  await db.insert(documentoEmpresa).values({ id: did, empresaId: eid, titulo: 'Ficticio', archivoStoragePath: key, archivoNombreOriginal: 'ficticio.pdf' });
  const storage = Object.create(StorageService.prototype); storage.bucketName = c.bucket; storage.logger = { error() {} };
  storage.minioClient = { removeObject: async () => {
    assert.equal((await db.select().from(documentoEmpresa).where(eq(documentoEmpresa.id, did))).length, 0);
    throw new Error('storage caído');
  } };
  const { DocumentosEmpresaService } = require('../../dist/documentos-empresa/documentos-empresa.service');
  const service = new DocumentosEmpresaService({ getEmpresaId: async () => eid }, storage, {});
  assert.match((await service.eliminar(randomUUID(), did)).mensaje, /eliminado/);
  const [task] = await c.service.listar(); assert.equal(task.objectPath, key); assert.equal(task.motivo, 'LIMPIEZA_FALLIDA');
});
test('Reintentos concurrentes eliminan una vez y conservan estado persistido', async t => {
  const c = caso(t), key = c.key(); c.paths.add(key); const task = await c.pendiente(key);
  const results = await Promise.all([c.service.reintentar(task.id), c.service.reintentar(task.id)]);
  assert.equal(results.filter(r => r.eliminado).length, 1); assert.deepEqual(c.borrados, [key]);
  assert.equal((await c.service.listar())[0].estado, 'ELIMINADO');
});
test('Fallo persiste intento/error genérico, espera una hora y sobrevive a nueva instancia', async t => {
  const c = caso(t), task = await c.pendiente(c.key());
  c.storage.removeObjectForReconciliation = async () => { throw new Error('fallo con secreto'); };
  assert.equal((await c.service.reintentar(task.id)).eliminado, false);
  const [actual] = await new ReconciliacionService(c.storage).listar();
  assert.equal(actual.intentos, 2); assert.doesNotMatch(actual.ultimoError, /secreto/);
  assert.ok(actual.proximoIntento > new Date(Date.now() + 3500000));
  await assert.rejects(c.service.reintentar(task.id), /Retención/);
});
test('Objeto que reaparece después de eliminación se revisa sin reutilizar orden de borrado antigua', async t => {
  const c = caso(t), key = c.key(), task = await c.pendiente(key); c.paths.add(key);
  await c.service.reintentar(task.id); c.paths.add(key); await c.service.conciliar();
  const [actual] = await c.service.listar(); assert.equal(actual.motivo, 'SIN_REFERENCIA');
  await assert.rejects(c.service.reintentar(actual.id), /requiere revisión/);
});
test('Fallo de deleteFile se registra durablemente con bucket y retención', async t => {
  const c = caso(t), key = c.key();
  const storage = Object.create(StorageService.prototype); storage.bucketName = c.bucket;
  storage.logger = { error() {} }; storage.minioClient = { removeObject: async () => { throw new Error('fallo'); } };
  await assert.rejects(storage.deleteFile(key), /fallo/);
  const [task] = await c.service.listar(); assert.equal(task.motivo, 'LIMPIEZA_FALLIDA');
  assert.ok(task.proximoIntento > new Date(Date.now() + 6 * 86400000));
});
test('HTTP real: exige sesión, superadmin y permiso SA_EMPRESA_MANAGE', async t => {
  const c = caso(t);
  const { Module } = require('@nestjs/common'), { NestFactory } = require('@nestjs/core'), { FastifyAdapter } = require('@nestjs/platform-fastify');
  const { JwtService } = require('@nestjs/jwt'), { SesionesService } = require('../../dist/auth/sesiones.service');
  const { PermisosService } = require('../../dist/common/permisos/permisos.service'), { JwtStrategy } = require('../../dist/auth/jwt.strategy');
  const { JwtAuthGuard } = require('../../dist/auth/jwt-auth.guard'), { SuperadminGuard } = require('../../dist/auth/superadmin.guard');
  const { SuperadminPermisoGuard } = require('../../dist/superadmin/superadmin-permiso.guard');
  const { ReconciliacionController } = require('../../dist/storage/reconciliacion.controller');
  const sessions = new SesionesService(new JwtService({ secret: process.env.JWT_SECRET }), new PermisosService());
  class TestModule {}
  Module({ controllers: [ReconciliacionController], providers: [
    { provide: ReconciliacionService, useValue: c.service }, { provide: JwtStrategy, useValue: new JwtStrategy(sessions) },
    JwtAuthGuard, SuperadminGuard, SuperadminPermisoGuard] })(TestModule);
  const app = await NestFactory.create(TestModule, new FastifyAdapter(), { logger: false }); t.after(() => app.close()); await app.init();
  const http = app.getHttpAdapter().getInstance();
  const request = token => http.inject({ method: 'POST', url: '/superadmin/storage/conciliar', headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal((await request()).statusCode, 401);
  for (const [tipoUsuario, permitido] of [['CONTADOR_EXTERNO', false], ['SUPERADMIN', true]]) {
    const [user] = await db.insert(usuario).values({ email: `${randomUUID()}@example.test`, tipoUsuario }).returning();
    t.after(() => db.delete(usuario).where(eq(usuario.id, user.id)));
    const token = (await sessions.crear(user)).access_token;
    assert.equal((await request(token)).statusCode, 403);
    if (permitido) {
      await db.insert(superadminPermiso).values({ usuarioId: user.id, codigoPermiso: 'SA_EMPRESA_MANAGE' });
      assert.equal((await request(token)).statusCode, 201);
    }
  }
});
