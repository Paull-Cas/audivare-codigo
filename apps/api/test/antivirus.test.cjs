const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Readable } = require('node:stream');
process.env.NODE_ENV = 'test';
delete process.env.ANTIVIRUS_MODE;
const { ClamavClient } = require('../dist/storage/clamav.client');
const { revisarPdf, AnalisisArchivosService } = require('../dist/storage/analisis-archivos.service');
const { StorageService } = require('../dist/storage/storage.service');
const { getAntivirusConfig } = require('../dist/storage/antivirus.config');
const { PDFDocument, PDFName, PDFString } = require('pdf-lib');
const png = readFileSync(join(__dirname, 'fixtures/adjunto.png'));
const clean = { estado: 'LIMPIO', motivo: 'ANALIZADO', motor: 'ClamAV ficticio' };
const infected = { estado: 'CUARENTENA', motivo: 'DETECCION_ANTIVIRUS' };
const unavailable = { estado: 'ERROR', motivo: 'ESCANER_NO_DISPONIBLE' };

async function daemon(t, { reply = 'stream: OK\0', version, hold = false } = {}) {
  const sockets = new Set(), payloads = [];
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let bytes = Buffer.alloc(0), command;
    socket.on('data', chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!command) {
        const end = bytes.indexOf(0); if (end < 0) return;
        command = bytes.subarray(0, end).toString(); bytes = bytes.subarray(end + 1);
        if (command === 'zVERSION') {
          if (!hold) socket.end(version ?? `ClamAV 1.4.3/12345/${new Date().toUTCString().replace(/ GMT$/, '')}\0`);
          return;
        }
      }
      if (command !== 'zINSTREAM') return;
      const chunks = socket.chunks ??= [];
      while (bytes.length >= 4) {
        const length = bytes.readUInt32BE(0); if (bytes.length < length + 4) return;
        if (length === 0) { payloads.push(Buffer.concat(chunks)); socket.end(reply); return; }
        assert.ok(length <= 65536); chunks.push(bytes.subarray(4, length + 4)); bytes = bytes.subarray(length + 4);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { client: new ClamavClient({ host: '127.0.0.1', port: server.address().port, timeoutMs: hold ? 60 : 2000 }), payloads };
}

test('ClamAV INSTREAM transmite exactamente los bytes en bloques y exige respuesta completa', async t => {
  const d = await daemon(t), buffer = Buffer.alloc(180000, 127);
  assert.equal((await d.client.analizar(buffer)).estado, 'LIMPIO');
  assert.deepEqual(d.payloads, [buffer]);
});
test('Detección persiste motivo genérico sin divulgar nombre de firma', async t => {
  const d = await daemon(t, { reply: 'stream: Eicar-Test-Signature FOUND\0' });
  assert.deepEqual(await d.client.analizar(png), { ...infected, motor: 'ClamAV 1.4.3/12345' });
});
for (const reply of ['stream: OK', 'stream: OK\0stream: Threat FOUND\0', 'INSTREAM size limit exceeded. ERROR\0', 'stream: encrypted ERROR\0']) {
  test(`Respuesta incompleta/ambigua nunca habilita archivo: ${JSON.stringify(reply)}`, async t => {
    const d = await daemon(t, { reply }); assert.equal((await d.client.analizar(png)).estado, 'ERROR');
  });
}
for (const days of [-3, 1]) test(`Firmas fuera de vigencia (${days} días) impiden INSTREAM`, async t => {
  const version = `ClamAV 1.4.3/12345/${new Date(Date.now() + days * 86400000).toUTCString().replace(/ GMT$/, '')}\0`;
  const d = await daemon(t, { version });
  assert.equal((await d.client.analizar(png)).motivo, 'FIRMAS_NO_VIGENTES'); assert.equal(d.payloads.length, 0);
});
test('Timeout del daemon no habilita archivo y libera capacidad para reintento', async t => {
  const d = await daemon(t, { hold: true });
  assert.equal((await d.client.analizar(png)).estado, 'ERROR');
  assert.equal((await d.client.analizar(png)).estado, 'ERROR');
  const healthy = await daemon(t); assert.equal((await healthy.client.analizar(png)).estado, 'LIMPIO');
});
test('Producción exige modo explícito, admite omisión elegida y mantiene clamd privado', () => {
  const old = { NODE_ENV: process.env.NODE_ENV, ANTIVIRUS_MODE: process.env.ANTIVIRUS_MODE, CLAMAV_HOST: process.env.CLAMAV_HOST };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.ANTIVIRUS_MODE; assert.throws(getAntivirusConfig);
    process.env.ANTIVIRUS_MODE = 'disabled'; assert.equal(getAntivirusConfig().enabled, false);
    process.env.ANTIVIRUS_MODE = 'desactivado'; assert.throws(getAntivirusConfig);
    process.env.ANTIVIRUS_MODE = 'clamd'; delete process.env.CLAMAV_HOST; assert.throws(getAntivirusConfig);
    process.env.ANTIVIRUS_MODE = 'clamd'; process.env.CLAMAV_HOST = 'example.com'; assert.throws(getAntivirusConfig);
    process.env.CLAMAV_HOST = 'clamav.railway.internal'; assert.equal(getAntivirusConfig().enabled, true);
  } finally { for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value; }
});

async function pdf(change) {
  const doc = await PDFDocument.create(); doc.addPage(); if (change) await change(doc);
  return Buffer.from(await doc.save()); // Incluye object streams comprimidos por defecto.
}
test('PDF normal y campos de firma conservan bytes y son analizables', async () => {
  const buffer = await pdf(doc => doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: [doc.context.obj({ FT: 'Sig', T: 'firma' })] })));
  const original = Buffer.from(buffer); assert.equal(await revisarPdf(buffer), 'ACEPTADO'); assert.deepEqual(buffer, original);
});
test('JavaScript en PDF comprimido se bloquea mediante análisis semántico', async () => {
  assert.equal(await revisarPdf(await pdf(doc => doc.addJavaScript('inicio', 'app.alert("test")'))), 'CONTENIDO_ACTIVO');
});
test('Archivo incrustado en PDF y acciones de apertura se bloquean', async () => {
  assert.equal(await revisarPdf(await pdf(doc => doc.attach(png, 'adjunto.png'))), 'CONTENIDO_ACTIVO');
  assert.equal(await revisarPdf(await pdf(doc => doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'Launch' })))), 'CONTENIDO_ACTIVO');
});
test('PDF truncado no se clasifica como limpio', async () => {
  assert.equal(await revisarPdf(Buffer.from('%PDF-1.7\n%%EOF')), 'PDF_NO_ANALIZABLE');
});
test('Enlace HTTPS ordinario se conserva; URI ejecutable se bloquea', async () => {
  const conUri = uri => pdf(doc => doc.catalog.set(PDFName.of('AccionFicticia'), doc.context.obj({ S: 'URI', URI: PDFString.of(uri) })));
  assert.equal(await revisarPdf(await conUri('https://example.test/documento')), 'ACEPTADO');
  assert.equal(await revisarPdf(await conUri('javascript:alert(1)')), 'CONTENIDO_ACTIVO');
});

function storageCase(result = clean) {
  const rows = new Map(), calls = { put: 0, presign: 0, delete: 0, scan: 0, get: 0 };
  const analysis = { enabled: true, resultado: result, exigirLimpio: AnalisisArchivosService.prototype.exigirLimpio,
    analizarBuffer: async buffer => { calls.scan++; assert.deepEqual(buffer, png); return analysis.resultado; },
    obtener: async (bucket, key) => rows.get(key), registrar: async (bucket, key, verdict, buffer, etag) => rows.set(key, { ...verdict, buffer, etag }) };
  const storage = Object.create(StorageService.prototype); storage.bucketName = 'ficticio'; storage.analisis = analysis;
  storage.minioClient = { putObject: async () => { calls.put++; return { etag: 'v1' }; },
    statObject: async () => ({ size: png.length, etag: 'v1' }),
    getObject: async () => { calls.get++; return Readable.from(png); },
    presignedGetObject: async () => { calls.presign++; return 'url-ficticia'; },
    removeObject: async () => { calls.delete++; } };
  return { storage, analysis, rows, calls };
}
for (const verdict of [infected, unavailable]) test(`Adjunto nuevo ${verdict.estado} no escribe ni borra R2`, async () => {
  const c = storageCase(verdict);
  await assert.rejects(c.storage.uploadFile({ buffer: png, filename: 'pago.png', mimetype: 'image/png' }, 'facturas/ficticio'), e => [403, 503].includes(e.getStatus()));
  assert.equal(c.calls.put, 0); assert.equal(c.calls.delete, 0);
});
test('Fallo de registro posterior a upload conserva huérfano y no confirma carga', async () => {
  const c = storageCase(); c.analysis.registrar = async () => { throw new Error('BD caída'); };
  await assert.rejects(c.storage.uploadFile({ buffer: png, filename: 'pago.png', mimetype: 'image/png' }, 'facturas/ficticio'));
  assert.equal(c.calls.put, 1); assert.equal(c.calls.delete, 0);
});
test('Cuarentena impide URL y stream hasta reanálisis limpio, sin eliminar original', async () => {
  const c = storageCase(infected), key = 'empresa/ficticio.png';
  await assert.rejects(c.storage.getPresignedUrl(key), e => e.getStatus() === 403);
  assert.equal(c.rows.get(key).estado, 'CUARENTENA');
  c.analysis.resultado = clean;
  await assert.rejects(c.storage.getObjectStream(key), e => e.getStatus() === 403);
  assert.equal(c.calls.scan, 1); assert.equal(c.calls.presign, 0);
  assert.deepEqual(await c.storage.reanalizarObjeto(key), { estado: 'LIMPIO' });
  const chunks = []; for await (const chunk of await c.storage.getObjectStream(key)) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), png); assert.equal(c.calls.delete, 0);
});
test('Error de antivirus se registra y permite reintentar; no usa limpio anterior como caché', async () => {
  const c = storageCase(unavailable), key = 'empresa/ficticio.png';
  await assert.rejects(c.storage.getPresignedUrl(key), e => e.getStatus() === 503);
  assert.equal(c.rows.get(key).estado, 'ERROR'); c.analysis.resultado = clean;
  assert.equal(await c.storage.getPresignedUrl(key), 'url-ficticia'); c.analysis.resultado = infected;
  await assert.rejects(c.storage.getPresignedUrl(key), e => e.getStatus() === 403);
  assert.equal(c.calls.presign, 1); assert.equal(c.calls.scan, 3);
});
test('Objeto reemplazado durante lectura no entrega URL ni stream', async () => {
  const c = storageCase(); let stat = 0;
  c.storage.minioClient.statObject = async () => ({ size: png.length, etag: ++stat === 1 ? 'v1' : 'v2' });
  await assert.rejects(c.storage.getPresignedUrl('empresa/ficticio.png'), e => e.getStatus() === 503);
  assert.equal(c.calls.scan, 0); assert.equal(c.calls.presign, 0); assert.equal(c.rows.get('empresa/ficticio.png').estado, 'ERROR');
});

test('Upload limpio registra los mismos bytes y etag que se guardaron', async () => {
  const c = storageCase();
  const key = await c.storage.uploadFile({ buffer: png, filename: 'pago.png', mimetype: 'image/png' }, 'facturas/ficticio');
  assert.equal(c.calls.put, 1); assert.equal(c.rows.get(key).estado, 'LIMPIO');
  assert.deepEqual(c.rows.get(key).buffer, png); assert.equal(c.rows.get(key).etag, 'v1');
});
test('Objeto demasiado grande no se descarga ni se firma', async () => {
  const c = storageCase(); c.storage.minioClient.statObject = async () => ({ size: 10 * 1024 * 1024 + 1, etag: 'v1' });
  await assert.rejects(c.storage.getPresignedUrl('empresa/ficticio.png'), e => e.getStatus() === 503);
  assert.equal(c.calls.get, 0); assert.equal(c.calls.presign, 0);
});
test('Contenido con extensión falsa se pone en cuarentena antes del escáner', async () => {
  const c = storageCase();
  await assert.rejects(c.storage.getPresignedUrl('empresa/falso.pdf'), e => e.getStatus() === 403);
  assert.equal(c.rows.get('empresa/falso.pdf').motivo, 'FORMATO_NO_ADMITIDO'); assert.equal(c.calls.scan, 0);
});
for (const verdict of [infected, unavailable]) test(`Importación ${verdict.estado} se detiene antes del lector y de escribir BD`, async () => {
  const { ImportacionService } = require('../dist/contadores/importacion.service');
  const { randomUUID } = require('node:crypto');
  let scans = 0;
  const service = new ImportacionService({}, {}, { enabled: true,
    analizarBuffer: async () => { scans++; return verdict; }, exigirLimpio: AnalisisArchivosService.prototype.exigirLimpio });
  service.verificarVinculo = async () => {};
  service.leerCsv = () => { throw new Error('No debe llegar al lector'); };
  await assert.rejects(service.importar(randomUUID(), 'CONTADOR_EXTERNO', randomUUID(), { filename: 'ficticio.csv', buffer: Buffer.from('contenido') }), e => [403, 503].includes(e.getStatus()));
  assert.equal(scans, 1);
});
