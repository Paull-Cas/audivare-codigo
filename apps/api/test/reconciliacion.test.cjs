const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/audivare_test';
const { db } = require('@audivare/database');
const { clasificarStorage } = require('../dist/storage/reconciliacion.service');
const { StorageService } = require('../dist/storage/storage.service');
test('Inventario distingue objetos gestionados, archivos faltantes y desconocidos sin borrar', () => {
  const key = `facturas/${randomUUID()}/${randomUUID()}.pdf`, pago = `facturas/${randomUUID()}/pagos/${randomUUID()}.pdf`;
  const result = clasificarStorage([key, key, 'otra-carpeta/archivo.pdf'], [pago, pago]);
  assert.deepEqual(result.sin_referencia, [key]); assert.deepEqual(result.referencias_faltantes, [pago]);
  assert.deepEqual(result.no_gestionados, ['otra-carpeta/archivo.pdf']);
});
test('Objeto referenciado nunca se clasifica como sin referencia', () => {
  const key = `empresa/${randomUUID()}/documentos/${randomUUID()}.PNG`;
  assert.deepEqual(clasificarStorage([key], [key]).sin_referencia, []);
});
test('Fallo de borrado persiste tarea y conserva error original sin registrar secretos', async t => {
  let values, update;
  t.mock.method(db, 'insert', () => ({ values: v => { values = v; return { onConflictDoUpdate: async u => { update = u; } }; } }));
  const service = Object.create(StorageService.prototype);
  service.bucketName = 'bucket-test'; service.logger = { error() {} };
  service.minioClient = { removeObject: async () => { throw new Error('fallo-ficticio-clave-privada'); } };
  await assert.rejects(service.deleteFile('objeto.pdf'), /fallo-ficticio/);
  assert.equal(values.motivo, 'LIMPIEZA_FALLIDA'); assert.equal(values.bucket, 'bucket-test');
  assert.ok(values.proximoIntento > new Date(Date.now() + 6 * 86400000));
  assert.doesNotMatch(values.ultimoError, /clave-privada/); assert.equal(update.set.estado, 'PENDIENTE');
});
test('Si no puede guardar la tarea, avisa y conserva el fallo; no declara éxito', async t => {
  t.mock.method(db, 'insert', () => { throw new Error('BD no disponible'); });
  let avisos = 0;
  const service = Object.create(StorageService.prototype);
  service.bucketName = 'bucket-test'; service.logger = { error() { avisos++; } };
  service.minioClient = { removeObject: async () => { throw new Error('storage no disponible'); } };
  await assert.rejects(service.deleteFile('objeto.pdf'), /storage no disponible/); assert.equal(avisos, 1);
});
test('Inventario interrumpido no devuelve lista parcial y aplica límite', async () => {
  const service = Object.create(StorageService.prototype); service.bucketName = 'test';
  service.minioClient = { async *listObjectsV2() { yield { name: 'a' }; throw new Error('interrumpido'); } };
  await assert.rejects(service.listObjectInventory(), /interrumpido/);
  service.minioClient = { async *listObjectsV2() { yield { name: 'a' }; yield { name: 'b' }; } };
  await assert.rejects(service.listObjectInventory(1), /límite/);
});
