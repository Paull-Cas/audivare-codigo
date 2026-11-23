const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { createServer } = require('node:http');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/audivare_test';
process.env.JWT_SECRET = 'secreto-exclusivo-de-tests-con-32-caracteres';

test('ExcelJS escribe/lee XLSX con céntimos, USD y UUID compatibles', async () => {
  const ExcelJS = require('exceljs');
  const excelRequire = createRequire(require.resolve('exceljs'));
  assert.match(excelRequire('uuid').v4(), /^[0-9a-f-]{36}$/);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Pagos');
  hoja.addRows([['Moneda', 'Monto'], ['USD', 0.29], ['PEN', 120.57]]);
  hoja.getColumn(2).numFmt = '0.00';
  const buffer = await libro.xlsx.writeBuffer();
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(buffer);
  assert.equal(leido.worksheets[0].getCell('A2').value, 'USD');
  assert.equal(leido.worksheets[0].getCell('B3').value, 120.57);
});

test('Archiver genera ZIP descargable con archivos y nombres conservados', async () => {
  const { ZipArchive } = await import('archiver');
  const excelRequire = createRequire(require.resolve('exceljs'));
  const unzipper = excelRequire('unzipper');
  const archivo = new ZipArchive({ zlib: { level: 9 } });
  const chunks = [];
  const fin = new Promise((resolve, reject) => {
    archivo.on('data', (chunk) => chunks.push(chunk));
    archivo.on('end', resolve); archivo.on('error', reject);
  });
  archivo.append(Buffer.from('comprobante de prueba'), { name: 'Empresa/2026/pagos/comprobante.pdf' });
  await archivo.finalize(); await fin;
  const zip = await unzipper.Open.buffer(Buffer.concat(chunks));
  assert.equal(zip.files[0].path, 'Empresa/2026/pagos/comprobante.pdf');
  assert.equal((await zip.files[0].buffer()).toString(), 'comprobante de prueba');
});

test('MinIO conserva subida, lectura, URL firmada y borrado mediante S3 local simulado', async (t) => {
  const objetos = new Map();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.searchParams.has('location')) {
      res.setHeader('content-type', 'application/xml');
      res.end('<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-east-1</LocationConstraint>');
      return;
    }
    const key = decodeURIComponent(url.pathname);
    if (req.method === 'HEAD') { res.end(); return; }
    if (req.method === 'PUT') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      objetos.set(key, Buffer.concat(chunks)); res.setHeader('etag', '"0123456789abcdef0123456789abcdef"'); res.end(); return;
    }
    if (req.method === 'DELETE') { objetos.delete(key); res.statusCode = 204; res.end(); return; }
    if (req.method === 'GET' && objetos.has(key)) { res.end(objetos.get(key)); return; }
    res.statusCode = 404; res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const envPrueba = { MINIO_ENDPOINT: '127.0.0.1', MINIO_PORT: String(server.address().port),
    MINIO_USE_SSL: 'false', MINIO_ACCESS_KEY: 'clave-de-pruebas',
    MINIO_SECRET_KEY: 'secreto-de-pruebas-no-real', MINIO_BUCKET: 'bucket-test' };
  for (const [key, value] of Object.entries(envPrueba)) {
    const anterior = process.env[key]; process.env[key] = value;
    t.after(() => { if (anterior === undefined) delete process.env[key]; else process.env[key] = anterior; });
  }
  const { StorageService } = require('../dist/storage/storage.service');
  const storage = new StorageService();
  const contenido = '%PDF-1.7\ncontenido ficticio para prueba de transporte\n%%EOF\n';
  const key = await storage.uploadFile({ filename: 'pago.pdf', mimetype: 'application/pdf', buffer: Buffer.from(contenido) }, 'facturas/test/pagos');
  const url = new URL(await storage.getPresignedUrl(key));
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  assert.ok(url.searchParams.has('X-Amz-Signature'));
  const chunks = [];
  for await (const chunk of await storage.getObjectStream(key)) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), contenido);
  await storage.deleteFile(key); assert.equal(objetos.size, 0);
});

test('NestJS/Fastify registra rutas, mantiene guard y procesa multipart con límite', async (t) => {
  const { Controller, Get, Post, Req, UseGuards, Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify');
  const { JwtAuthGuard } = require('../dist/auth/jwt-auth.guard');
  const { JwtStrategy } = require('../dist/auth/jwt.strategy');
  const { parseMultipart } = require('../dist/common/multipart.util');
  class CompatController {
    protegida() { return { ok: true }; }
    async archivo(req) {
      const { file, fields } = await parseMultipart(req);
      return { nombre: file.filename, contenido: file.buffer.toString(), nota: fields.nota };
    }
  }
  Controller('compat')(CompatController);
  Get('protegida')(CompatController.prototype, 'protegida', Object.getOwnPropertyDescriptor(CompatController.prototype, 'protegida'));
  UseGuards(JwtAuthGuard)(CompatController.prototype, 'protegida', Object.getOwnPropertyDescriptor(CompatController.prototype, 'protegida'));
  Post('archivo')(CompatController.prototype, 'archivo', Object.getOwnPropertyDescriptor(CompatController.prototype, 'archivo'));
  Req()(CompatController.prototype, 'archivo', 0);
  class CompatModule {}
  Module({ controllers: [CompatController], providers: [JwtAuthGuard,
    { provide: JwtStrategy, useValue: new JwtStrategy({ validar: async () => ({ id: 'test' }) }) }] })(CompatModule);
  const app = await NestFactory.create(CompatModule, new FastifyAdapter(), { logger: false });
  t.after(() => app.close());
  await app.register(require('@fastify/multipart'), { limits: { fileSize: 32 } });
  app.enableCors({ origin: 'https://web.example.test', credentials: true });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  assert.equal((await fastify.inject({ method: 'GET', url: '/compat/protegida' })).statusCode, 401);
  const preflight = await fastify.inject({ method: 'OPTIONS', url: '/compat/archivo', headers: {
    origin: 'https://web.example.test', 'access-control-request-method': 'POST' } });
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://web.example.test');
  const multipart = (contenido) => `--test-boundary\r\nContent-Disposition: form-data; name="nota"\r\n\r\nprueba\r\n--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="pago.pdf"\r\nContent-Type: application/pdf\r\n\r\n${contenido}\r\n--test-boundary--\r\n`;
  const headers = { 'content-type': 'multipart/form-data; boundary=test-boundary' };
  const ok = await fastify.inject({ method: 'POST', url: '/compat/archivo', headers, payload: multipart('ficticio') });
  assert.equal(ok.statusCode, 201); assert.deepEqual(ok.json(), { nombre: 'pago.pdf', contenido: 'ficticio', nota: 'prueba' });
  const grande = await fastify.inject({ method: 'POST', url: '/compat/archivo', headers, payload: multipart('x'.repeat(33)) });
  assert.equal(grande.statusCode, 413);
});
