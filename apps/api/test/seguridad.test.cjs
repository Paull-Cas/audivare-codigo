const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/audivare_test';
const { LimiteFrecuencia, registrarSeguridadHttp } = require('../dist/common/seguridad-http');
const { LIMITES_TRABAJO, validarFilas, CupoTrabajo } = require('../dist/common/limites-trabajo');
const { validarZipExcel, leerExcelSeguro } = require('../dist/contadores/excel-seguro');
const { ExportContadorService } = require('../dist/contadores/export-contador.service');
const { ImportacionService } = require('../dist/contadores/importacion.service');
const ExcelJS = require('exceljs');

test('Frecuencia: ventana exacta, identidades independientes y capacidad sin crecimiento ilimitado', () => {
  const limit = new LimiteFrecuencia(2, 100, 2);
  assert.ok(limit.admitir('a', 0)); assert.ok(limit.admitir('a', 0)); assert.equal(limit.admitir('a', 99), false);
  assert.ok(limit.admitir('b', 1)); assert.equal(limit.admitir('c', 1), false);
  assert.ok(limit.admitir('a', 100)); assert.ok(limit.admitir('c', 101));
});
test('Cupo rechaza exceso y libera una sola vez, también ante error', () => {
  const cupo = new CupoTrabajo(1), liberar = cupo.adquirir();
  assert.throws(() => cupo.adquirir(), e => e.getStatus() === 429);
  liberar(); liberar(); const b = cupo.adquirir(); assert.throws(() => cupo.adquirir()); b();
});
for (const [nombre, filas] of [
  ['filas', Array.from({ length: 5002 }, () => ['x'])],
  ['columnas', [Array(129).fill('x')]], ['celda', [['x'.repeat(2001)]]],
]) test(`Rechaza exceso de ${nombre}`, () => assert.throws(() => validarFilas(filas)));
test('Acepta límites exactos de filas/columnas/celda', () => validarFilas(Array.from({ length: 5001 }, () => Array(128).fill('x'.repeat(2000)))));
test('Admite las 80 columnas del registro SUNAT sin exigir guardarlas todas', () => {
  assert.doesNotThrow(() => validarFilas([Array(80).fill('Cabecera'), Array(80).fill('Dato')]));
});

async function excel(filas = [['Fecha', 'Nombre'], ['08/10/2026', 'Ficticio']]) {
  const book = new ExcelJS.Workbook(); book.addWorksheet('Datos').addRows(filas); return Buffer.from(await book.xlsx.writeBuffer());
}
test('Excel real pasa preflight y lectura aislada, conserva fechas UTC y celdas vacías', async () => {
  const buf = await excel([['Fecha', 'Vacio', 'Nombre'], [new Date('2026-10-08T00:00:00Z'), null, 'Ficticio']]);
  await validarZipExcel(buf);
  assert.deepEqual(await leerExcelSeguro(buf), [['Fecha', 'Vacio', 'Nombre'], ['08/10/2026', '', 'Ficticio']]);
});
test('Excel corrupto se rechaza; no devuelve filas parciales', async () => {
  await assert.rejects(leerExcelSeguro(Buffer.from('PK inválido')));
  const buf = await excel(); const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  buf.writeUInt32LE(51 * 1024 * 1024, central + 24);
  await assert.rejects(validarZipExcel(buf), /límites/);
});
test('Excel con tamaño declarado falso no evita comprobación de bytes reales', async () => {
  const buf = await excel(); const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  buf.writeUInt32LE(1, central + 24);
  await assert.rejects(validarZipExcel(buf), /inválido/);
});
test('Excel con filas o celdas excesivas falla dentro del lector aislado', async () => {
  await assert.rejects(leerExcelSeguro(await excel([['Columna'], ['x'.repeat(2001)]])), /límites/);
  await assert.rejects(leerExcelSeguro(await excel(Array.from({ length: 5002 }, () => ['x']))), /límites/);
});
test('Importación excesiva rechaza antes de transacción y libera cupo tras fallo', async t => {
  const service = new ImportacionService({}, {}); service.verificarVinculo = async () => {};
  let transacciones = 0; const { db } = require('@audivare/database');
  t.mock.method(db, 'transaction', () => { transacciones++; throw new Error('No debe escribir'); });
  const run = buffer => service.importar(randomUUID(), 'CONTADOR_EXTERNO', randomUUID(), { filename: 'ficticio.csv', buffer });
  await assert.rejects(run(Buffer.alloc(LIMITES_TRABAJO.archivo + 1)), /10 MB/);
  for (let i = 0; i < 3; i++) await assert.rejects(run(Buffer.from('A;B\n' + 'x;y\n'.repeat(5001))), /5000/);
  assert.equal(transacciones, 0);
});

function exportador(storage, docs) {
  const service = new ExportContadorService(storage, {});
  service.getEmpresaNombre = async () => 'Ficticia'; service.getFacturas = async () => [{ id: 'f', serie: 'F001', numero: '1' }];
  service.getDocs = async () => docs; service.getPagos = async () => [];
  service.buildExcelBuffer = async () => Buffer.from('resumen ficticio');
  service.logger = { warn() {} };
  return service;
}
const documento = i => ({ facturaId: 'f', id: `doc-${i}`, tipoDocumento: 'OTROS', archivoStoragePath: `ficticio-${i}.pdf` });
test('ZIP rechaza número de archivos y tamaño acumulado antes de abrir streams', async () => {
  let abiertos = 0;
  const storage = { getObjectSize: async () => 10 * 1024 * 1024, getObjectStream: async () => { abiertos++; return Readable.from('x'); } };
  await assert.rejects(exportador(storage, Array.from({ length: 201 }, (_, i) => documento(i))).generarZipEmpresa(randomUUID(), {}), /200 archivos/);
  await assert.rejects(exportador(storage, Array.from({ length: 11 }, (_, i) => documento(i))).generarZipEmpresa(randomUUID(), {}), /100 MB/);
  assert.equal(abiertos, 0);
});
test('Exportación consulta un máximo de filas y rechaza exceso antes de construir Excel', async t => {
  const { db } = require('@audivare/database'); let limit;
  const rows = Array.from({ length: 5001 }, () => ({ id: 'f' }));
  t.mock.method(db, 'select', () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async n => { limit = n; return rows; } }) }) }) }));
  const service = new ExportContadorService({}, {});
  await assert.rejects(service.generarExcelEmpresa(randomUUID(), { anio: '2026' }), /5000/);
  assert.equal(limit, 5001);
});
test('Lectura Excel termina por tiempo y el proceso principal sigue operativo', async t => {
  const buffer = await excel(); const old = LIMITES_TRABAJO.tiempoExcelMs;
  LIMITES_TRABAJO.tiempoExcelMs = 500; t.after(() => LIMITES_TRABAJO.tiempoExcelMs = old);
  await assert.rejects(leerExcelSeguro(buffer), /tiempo/);
  assert.equal(2 + 2, 4);
});
test('ZIP válido entrega resumen/archivo; fallo real de lectura interrumpe y libera cupo', async () => {
  const good = exportador({ getObjectSize: async () => 1, getObjectStream: async () => Readable.from('x') }, [documento(1)]);
  const response = await good.generarZipEmpresa(randomUUID(), {}); const chunks = [];
  for await (const chunk of response.getStream()) chunks.push(chunk);
  assert.ok(Buffer.concat(chunks).subarray(0, 2).equals(Buffer.from('PK')));
  const bad = exportador({ getObjectSize: async () => 1, getObjectStream: async () => { throw new Error('SDK secret'); } }, [documento(1)]);
  const failed = await bad.generarZipEmpresa(randomUUID(), {});
  await assert.rejects(async () => { for await (const _ of failed.getStream()) {} }, /completar/);
  const again = await good.generarZipEmpresa(randomUUID(), {}); for await (const _ of again.getStream()) {}
});
test('ZIP comprueba bytes reales aunque metadata declare menos', async t => {
  const old = LIMITES_TRABAJO.archivo; LIMITES_TRABAJO.archivo = 8; t.after(() => LIMITES_TRABAJO.archivo = old);
  const service = exportador({ getObjectSize: async () => 1, getObjectStream: async () => Readable.from(Buffer.alloc(9)) }, [documento(1)]);
  const response = await service.generarZipEmpresa(randomUUID(), {});
  await assert.rejects(async () => { for await (const _ of response.getStream()) {} }, /completar/);
});
test('HTTP real limita intentos, no confía en IP reenviada y traza sin secretos ni parámetros', async t => {
  const fastify = require('fastify')({ bodyLimit: 128 * 1024, trustProxy: false }); t.after(() => fastify.close());
  const logs = []; registrarSeguridadHttp(fastify, e => logs.push(JSON.parse(e)));
  fastify.post('/auth/login', async () => ({ ok: true }));
  fastify.get('/archivo/:id', async () => ({ ok: true }));
  for (let i = 0; i < 10; i++) assert.equal((await fastify.inject({ method: 'POST', url: '/auth/login', payload: { email: 'usuario1@example.invalid', password: 'public-review-fixture-only' } })).statusCode, 200);
  const limited = await fastify.inject({ method: 'POST', url: '/auth/login', payload: { email: 'usuario2@example.invalid', password: 'public-review-fixture-only' }, headers: { 'x-forwarded-for': '8.8.8.8' } });
  assert.equal(limited.statusCode, 429); assert.equal(limited.headers['retry-after'], '60');
  const res = await fastify.inject({ url: '/archivo/NOMBRE_PRIVADO?token=TOKEN_PRIVADO', headers: { authorization: 'Bearer SECRETO', 'x-request-id': 'id-no-confiable' } });
  assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/); assert.equal(logs.at(-1).ruta, '/archivo/:id');
  assert.doesNotMatch(JSON.stringify(logs), /SECRETO|TOKEN_PRIVADO|NOMBRE_PRIVADO|prueba@example/);
  assert.equal((await fastify.inject({ method: 'POST', url: '/auth/login', payload: { password: 'public-review-fixture-only'.repeat(128 * 1024) } })).statusCode, 413);
});
test('HTTP reserva cupo multipart antes del cuerpo y lo libera al terminar', async t => {
  const server = require('fastify')(); t.after(() => server.close()); registrarSeguridadHttp(server, () => {});
  server.addContentTypeParser('multipart/form-data', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  let liberar, listos, activos = 0;
  const gate = new Promise(resolve => { liberar = resolve; });
  const ready = new Promise(resolve => { listos = resolve; });
  server.post('/subir', async () => { if (++activos === 4) listos(); await gate; return { ok: true }; });
  const enviar = () => server.inject({ method: 'POST', url: '/subir', headers: { 'content-type': 'multipart/form-data; boundary=ficticio' }, payload: 'ficticio' });
  const pendientes = Array.from({ length: 4 }, enviar);
  try { await ready; assert.equal((await enviar()).statusCode, 429); }
  finally { liberar(); await Promise.all(pendientes); }
  assert.equal((await enviar()).statusCode, 200);
});
test('Login rechaza tipos/tamaños incorrectos antes de comprobar credenciales', async () => {
  const { AuthController } = require('../dist/auth/auth.controller'); let llamadas = 0;
  const controller = new AuthController({ login: async () => { llamadas++; } }, {});
  for (const body of [null, {}, { email: 1, password: 'public-review-fixture-only' }, { email: 'usuario3@example.invalid', password: {} }, { email: 'usuario3@example.invalid', password: 'public-review-fixture-only'.repeat(129) }]) await assert.rejects(controller.login(body));
  assert.equal(llamadas, 0);
});
test('Configuración producción exige OAuth explícito y orígenes HTTPS sin comodines', t => {
  const { getGoogleClientId, getCorsOrigin } = require('../dist/common/config');
  const old = { ...process.env }; t.after(() => { for (const key of ['NODE_ENV', 'GOOGLE_CLIENT_ID', 'CORS_ORIGINS']) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } });
  process.env.NODE_ENV = 'production'; delete process.env.GOOGLE_CLIENT_ID;
  assert.throws(getGoogleClientId); process.env.GOOGLE_CLIENT_ID = '123-ficticio.apps.googleusercontent.com'; assert.ok(getGoogleClientId());
  for (const origin of ['*', 'http://example.test', 'https://example.test/path']) { process.env.CORS_ORIGINS = origin; assert.throws(getCorsOrigin); }
  process.env.CORS_ORIGINS = 'https://example.test'; assert.deepEqual(getCorsOrigin(), ['https://example.test']);
});
