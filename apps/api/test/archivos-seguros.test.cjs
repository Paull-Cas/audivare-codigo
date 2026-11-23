const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
process.env.NODE_ENV = 'test';
const { validarAdjunto, MAX_ARCHIVO_BYTES } = require('../dist/common/archivo-adjunto.util');
const { getStorageConfig } = require('../dist/storage/storage.config');
const { StorageService } = require('../dist/storage/storage.service');
const { parseMultipart } = require('../dist/common/multipart.util');
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const png = readFileSync(join(__dirname, 'fixtures/adjunto.png'));
const jpeg = readFileSync(join(__dirname, 'fixtures/adjunto.jpg'));
const archivo = (buffer = pdf, filename = 'pago.pdf', mimetype = 'application/pdf') => ({ buffer, filename, mimetype });

for (const [nombre, file, mime] of [
  ['PDF', archivo(), 'application/pdf'],
  ['PNG', archivo(png, 'estado.PNG', 'image/png'), 'image/png'],
  ['JPEG', archivo(jpeg, 'foto.jpeg', 'image/jpeg'), 'image/jpeg'],
  ['JPG', archivo(jpeg, 'foto.jpg', 'image/jpeg'), 'image/jpeg'],
]) test(`Adjunto válido ${nombre}`, () => assert.equal(validarAdjunto(file).mimetype, mime));

for (const [nombre, file, status = 400] of [
  ['vacío', archivo(Buffer.alloc(0))],
  ['HTML disfrazado de PDF', archivo(Buffer.from('<html><script>alert(1)</script></html>'))],
  ['MIME falsificado', archivo(pdf, 'pago.pdf', 'image/png')],
  ['extensión falsa', archivo(pdf, 'pago.jpg', 'image/jpeg')],
  ['SVG activo', archivo(Buffer.from('<svg/>'), 'pago.svg', 'image/svg+xml')],
  ['PDF truncado', archivo(pdf.subarray(0, pdf.length - 7))],
  ['PNG truncado', archivo(png.subarray(0, png.length - 3), 'foto.png', 'image/png')],
  ['JPEG truncado', archivo(jpeg.subarray(0, jpeg.length - 2), 'foto.jpg', 'image/jpeg')],
  ['firma JPEG sola', archivo(Buffer.from([255,216,255,217]), 'foto.jpg', 'image/jpeg')],
  ['ruta en nombre', archivo(pdf, '../pago.pdf')],
  ['carácter de control', archivo(pdf, 'pago\u0000.pdf')],
  ['supera 10 MB', archivo(Buffer.alloc(MAX_ARCHIVO_BYTES + 1)), 413],
]) test(`Rechaza ${nombre} antes de escribir storage`, async () => {
  let llamadas = 0;
  const storage = Object.create(StorageService.prototype);
  storage.bucketName = 'bucket-ficticio';
  storage.minioClient = { putObject: async () => { llamadas++; } };
  await assert.rejects(storage.uploadFile(file, 'facturas/test'), e => e.getStatus() === status);
  assert.equal(llamadas, 0);
});

test('Acepta 10 MB exactos y conserva tipo canónico y extensión normalizada', async () => {
  const buffer = Buffer.alloc(MAX_ARCHIVO_BYTES, 32);
  pdf.copy(buffer); Buffer.from('%%EOF\n').copy(buffer, buffer.length - 6);
  const storage = Object.create(StorageService.prototype);
  storage.bucketName = 'bucket-ficticio';
  let llamada;
  storage.minioClient = { putObject: async (...args) => { llamada = args; } };
  const key = await storage.uploadFile(archivo(buffer, 'PAGO.PDF'), 'facturas/test');
  assert.match(key, /^facturas\/test\/[0-9a-f-]+\.pdf$/);
  assert.equal(llamada[3], MAX_ARCHIVO_BYTES);
  assert.deepEqual(llamada[4], { 'Content-Type': 'application/pdf' });
});

function conEnv(values, fn) {
  const keys = ['NODE_ENV', 'MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_USE_SSL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) { if (values[k] === undefined) delete process.env[k]; else process.env[k] = values[k]; }
    return fn();
  } finally {
    for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }
  }
}
const seguro = { NODE_ENV: 'production', MINIO_ENDPOINT: 'account.r2.cloudflarestorage.com', MINIO_PORT: '443',
  MINIO_USE_SSL: 'true', MINIO_ACCESS_KEY: 'test-key', MINIO_SECRET_KEY: 'test-secret', MINIO_BUCKET: 'test-bucket' };
test('Storage local conserva defaults y HTTP', () => conEnv({ NODE_ENV: 'test' }, () => {
  const c = getStorageConfig(); assert.equal(c.client.useSSL, false); assert.equal(c.client.port, 9000);
}));
test('Producción con TLS y variables explícitas es válida', () => conEnv(seguro, () => {
  const c = getStorageConfig(); assert.equal(c.client.useSSL, true); assert.equal(c.client.port, 443);
}));
for (const [nombre, patch] of [
  ['HTTP', { MINIO_USE_SSL: 'false' }], ['SSL mal escrito', { MINIO_USE_SSL: 'TRUE' }],
  ['puerto parcial', { MINIO_PORT: '443abc' }], ['puerto fuera de rango', { MINIO_PORT: '65536' }],
  ['credencial de desarrollo', { MINIO_SECRET_KEY: 'public-review-fixture-only' }],
  ['URL en host', { MINIO_ENDPOINT: 'https://account.r2.cloudflarestorage.com' }],
  ...Object.keys(seguro).filter(k => k !== 'NODE_ENV').map(k => [`falta ${k}`, { [k]: undefined }]),
]) test(`Arranque rechaza ${nombre} antes de crear cliente`, () => conEnv({ ...seguro, ...patch }, () => {
  assert.throws(() => new StorageService());
}));

test('Multipart rechaza segundo archivo sin sobrescribir el primero', async () => {
  const req = { isMultipart: () => true, async *parts() {
    yield { type: 'file', filename: 'a.pdf', mimetype: 'application/pdf', file: {}, toBuffer: async () => pdf };
    yield { type: 'file', filename: 'b.pdf', mimetype: 'application/pdf', file: {}, toBuffer: async () => pdf };
  } };
  await assert.rejects(parseMultipart(req), e => e.getStatus() === 400);
});
test('Multipart rechaza campos duplicados y truncados', async () => {
  for (const values of [[{ fieldname: 'monto', value: '1' }, { fieldname: 'monto', value: '2' }],
    [{ fieldname: 'nota', value: 'cortado', valueTruncated: true }]]) {
    const req = { isMultipart: () => true, async *parts() { yield* values; } };
    await assert.rejects(parseMultipart(req), e => e.getStatus() === 400);
  }
});
test('Multipart rechaza stream truncado incluso si plugin no lanzó error', async () => {
  const req = { isMultipart: () => true, async *parts() {
    yield { type: 'file', filename: 'p.pdf', mimetype: 'application/pdf', file: { truncated: true }, toBuffer: async () => pdf };
  } };
  await assert.rejects(parseMultipart(req), e => e.getStatus() === 413);
});

test('HTTP multipart con límites reales: tamaño, archivo único y contenido', async t => {
  const fastify = require('fastify')({ bodyLimit: 12 * 1024 * 1024 });
  t.after(() => fastify.close());
  const { LIMITES_MULTIPART } = require('../dist/common/multipart.util');
  await fastify.register(require('@fastify/multipart'), { limits: LIMITES_MULTIPART });
  let escrituras = 0;
  const storage = Object.create(StorageService.prototype);
  storage.bucketName = 'test-bucket';
  storage.minioClient = { putObject: async () => { escrituras++; } };
  fastify.setErrorHandler((error, req, reply) => reply.code(error.getStatus?.() || error.statusCode || 500).send({ error: error.message }));
  fastify.post('/adjunto', async req => {
    const { file } = await parseMultipart(req);
    return { key: await storage.uploadFile(file, 'facturas/test') };
  });
  const part = content => Buffer.concat([Buffer.from('--b\r\nContent-Disposition: form-data; name="file"; filename="pago.pdf"\r\nContent-Type: application/pdf\r\n\r\n'), content, Buffer.from('\r\n')]);
  const inject = (...contents) => fastify.inject({ method: 'POST', url: '/adjunto',
    headers: { 'content-type': 'multipart/form-data; boundary=b' },
    payload: Buffer.concat([...contents.map(part), Buffer.from('--b--\r\n')]) });
  assert.equal((await inject(pdf)).statusCode, 200);
  assert.equal(escrituras, 1);
  assert.equal((await inject(Buffer.from('<html/>'))).statusCode, 400);
  assert.equal((await inject(Buffer.alloc(MAX_ARCHIVO_BYTES + 1))).statusCode, 413);
  assert.equal((await inject(pdf, pdf)).statusCode, 413);
  assert.equal(escrituras, 1);
});
