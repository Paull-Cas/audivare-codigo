const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
const { db, client, empresa, usuario, rol, usuarioInternoEmpresa, relacionEmpresaContador,
  factura, pagoFactura, historialFactura, documentoSustento, loteImportacion } = require('@audivare/database');
const { eq, sql } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { FacturasService } = require('../../dist/facturas/facturas.service');
const { ImportacionService } = require('../../dist/contadores/importacion.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const { NotificacionesService } = require('../../dist/notificaciones/notificaciones.service');
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
const datos = (extra = {}) => ({ tipoComprobante: '01', serie: 'F001', numero: '100', proveedorRuc: '20123456789',
  proveedorNombre: 'Proveedor ficticio', fechaEmision: '2026-10-01', moneda: 'PEN', montoTotal: '118.00', baseImponible: '100.00', igv: '18.00', ...extra });
const cabecera = ['Fecha de Emision', 'Serie', 'Nro CP o Doc. Nro Inicial (Rango)', 'Nro Doc Identidad', 'Apellidos Nombres/ Razon Social', 'Total CP', 'Moneda', 'Tipo de CDP'];
const fila = (n = '100', total = '118.00', ruc = '20123456789', fecha = '01/10/2026') => [fecha, ' f001 ', n, ruc, 'Proveedor ficticio', total, 'PEN', '01'];
const archivo = filas => ({ filename: 'ficticio.csv', mimetype: 'text/csv', buffer: Buffer.from([cabecera, ...filas].map(r => r.join(';')).join('\n')) });
async function caso(t) {
  const eid = randomUUID(), uid = randomUUID(), cid = randomUUID(), rid = randomUUID();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test`, ruc: '20' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), razonSocial: 'Empresa ficticia' });
  await db.insert(usuario).values([{ id: uid, email: `${uid}@example.test`, nombreCompleto: 'Autora ficticia', tipoUsuario: 'INTERNO' },
    { id: cid, email: `${cid}@example.test`, nombreCompleto: 'Contador ficticio', tipoUsuario: 'CONTADOR_EXTERNO' }]);
  await db.insert(rol).values({ id: rid, empresaId: eid, nombreRol: 'Administrador', esInmutable: true });
  await db.insert(usuarioInternoEmpresa).values({ usuarioId: uid, empresaId: eid, rolId: rid });
  await db.insert(relacionEmpresaContador).values({ empresaId: eid, contadorId: cid });
  t.after(async () => { await db.delete(empresa).where(eq(empresa.id, eid)); for (const id of [uid, cid]) await db.delete(usuario).where(eq(usuario.id, id)); });
  const storage = { async uploadFile() { return `ficticio/${randomUUID()}.pdf`; }, async deleteFile() {} };
  const permisos = new PermisosService(), avisos = new NotificacionesService();
  const service = new FacturasService(storage, permisos, avisos), imp = new ImportacionService(permisos, avisos);
  const interno = { kind: 'INTERNO', userId: uid }, contador = { kind: 'CONTADOR', userId: cid, empresaId: eid };
  return { eid, uid, cid, rid, interno, contador, service, storage,
    importar: (filas, revisar = false) => imp.importar(cid, 'CONTADOR_EXTERNO', eid, archivo(filas), revisar) };
}

test('Ambos actores crean; identidad normaliza espacios, mayúsculas y ceros; proveedor/tipo distinguen', async t => {
  const c = await caso(t);
  const f = await c.service.guardarFactura(c.interno, datos({ serie: ' f001 ', numero: '000100' }));
  assert.equal(f.numero, '100'); assert.equal(f.serie, 'F001'); assert.equal(f.saldoPendiente, '118.00'); assert.equal(f.documentacionEstado, 'PENDIENTE');
  await assert.rejects(c.service.guardarFactura(c.contador, datos()), e => e.getStatus() === 409);
  await c.service.guardarFactura(c.contador, datos({ proveedorRuc: '20987654321' }));
  await c.service.guardarFactura(c.contador, datos({ tipoComprobante: '03' }));
  assert.equal((await db.select().from(factura).where(eq(factura.empresaId, c.eid))).length, 3);
});
test('Manual → revisión Excel → confirmación: añade solo nuevas y conserva original, documentos y pagos', async t => {
  const c = await caso(t), f = await c.service.guardarFactura(c.interno, datos());
  await db.insert(documentoSustento).values({ facturaId: f.id, tipoDocumento: 'COTIZACION', archivoStoragePath: 'ficticio/cotizacion.pdf', archivoNombreOriginal: 'cotizacion.pdf' });
  await c.service.registrarPago(c.contador, f.id, { montoPagado: 18, file: { filename: 'pago.pdf', mimetype: 'application/pdf', buffer: Buffer.from('simulado') } });
  const filas = [fila('000100'), fila('100', '120.00', '20123456789', '01/11/2026'), fila('101'), fila('102', '118.00', '')];
  const p = await c.importar(filas, true);
  assert.deepEqual([p.revision.nuevas, p.revision.coincidentes, p.revision.diferencias, p.revision.identidadInsuficiente], [1, 1, 1, 1]);
  assert.equal((await db.select().from(loteImportacion).where(eq(loteImportacion.empresaId, c.eid))).length, 0);
  const r = await c.importar(filas); assert.equal(r.creadas, 1); assert.equal(r.omitidas, 3);
  const [original] = await db.select().from(factura).where(eq(factura.id, f.id));
  assert.equal(original.fechaEmision, '2026-10-01'); assert.equal(original.montoTotal, '118.00'); assert.equal(original.saldoPendiente, '100.00');
  assert.equal((await db.select().from(documentoSustento).where(eq(documentoSustento.facturaId, f.id))).length, 1);
  assert.equal((await db.select().from(pagoFactura).where(eq(pagoFactura.facturaId, f.id))).length, 1);
});
test('Edición con pagos recalcula estado/saldo y registra autor/antes/después; rechaza total insuficiente y moneda', async t => {
  const c = await caso(t), f = await c.service.guardarFactura(c.interno, datos());
  await c.service.registrarPago(c.contador, f.id, { montoPagado: 18, file: { filename: 'pago.pdf', buffer: Buffer.from('simulado') } });
  await assert.rejects(c.service.guardarFactura(c.interno, datos({ montoTotal: '17', baseImponible: '', igv: '' }), f.id), e => e.getStatus() === 400);
  await assert.rejects(c.service.guardarFactura(c.interno, datos({ moneda: 'USD' }), f.id), e => e.getStatus() === 400);
  const pagada = await c.service.guardarFactura(c.contador, datos({ montoTotal: '18', baseImponible: '', igv: '' }), f.id);
  assert.equal(pagada.estadoFactura, 'PAGADA'); assert.equal(pagada.saldoPendiente, '0.00');
  const abierta = await c.service.guardarFactura(c.interno, datos({ montoTotal: '119' }), f.id);
  assert.equal(abierta.estadoFactura, 'ACTIVA'); assert.equal(abierta.saldoPendiente, '101.00');
  const h = await db.select().from(historialFactura).where(eq(historialFactura.facturaId, f.id));
  const evento = h.find(h => h.usuarioId === c.cid && h.evento === 'Datos de factura editados');
  const d = JSON.parse(evento.detalle); assert.equal(d.autor, 'Contador ficticio');
  assert.deepEqual(d.cambios.find(c => c.campo === 'montoTotal'), { campo: 'montoTotal', antes: '118.00', despues: '18.00' });
});
test('Aislamiento, permisos BD y vínculo revocado impiden escritura', async t => {
  const a = await caso(t), b = await caso(t), f = await a.service.guardarFactura(a.interno, datos());
  await assert.rejects(b.service.guardarFactura(b.interno, datos(), f.id), e => e.getStatus() === 404);
  await assert.rejects(a.service.guardarFactura({ ...a.contador, empresaId: b.eid }, datos()), e => e.getStatus() === 403);
  await db.update(rol).set({ esInmutable: false }).where(eq(rol.id, a.rid));
  await assert.rejects(a.service.guardarFactura(a.interno, datos({ numero: '2' })), e => e.getStatus() === 403);
  await db.delete(relacionEmpresaContador).where(eq(relacionEmpresaContador.empresaId, a.eid));
  await assert.rejects(a.service.guardarFactura(a.contador, datos()), e => e.getStatus() === 403);
  await assert.rejects(a.service.guardarFactura({ kind: 'CONTADOR', userId: a.uid, empresaId: a.eid }, datos()), e => e.getStatus() === 403);
});
test('Creaciones manuales simultáneas y manual/importación no duplican', async t => {
  const c = await caso(t);
  const r = await Promise.allSettled([c.service.guardarFactura(c.interno, datos()), c.service.guardarFactura(c.contador, datos())]);
  assert.equal(r.filter(r => r.status === 'fulfilled').length, 1);
  const mixtas = await Promise.allSettled([c.service.guardarFactura(c.interno, datos({ numero: '101' })), c.importar([fila('101')])]);
  assert.ok(mixtas.some(r => r.status === 'fulfilled'));
  assert.equal((await db.select().from(factura).where(eq(factura.empresaId, c.eid))).length, 2);
});
test('Confirmación revalida una revisión anterior; no duplica ni altera otra creación posterior', async t => {
  const c = await caso(t); assert.equal((await c.importar([fila()], true)).revision.nuevas, 1);
  const f = await c.service.guardarFactura(c.interno, datos());
  const r = await c.importar([fila()]); assert.equal(r.creadas, 0); assert.equal(r.revision.coincidentes, 1);
  assert.equal((await c.service.findOne(c.uid, f.id)).factura.id, f.id);
});
test('Edición importada conserva lote; conflicto de identidad/version no deja historial parcial', async t => {
  const c = await caso(t); const r = await c.importar([fila('100'), fila('101')]);
  const fs = await db.select().from(factura).where(eq(factura.empresaId, c.eid)), f = fs.find(f => f.numero === '100');
  await assert.rejects(c.service.guardarFactura(c.interno, datos({ numero: '101' }), f.id), e => e.getStatus() === 409);
  const actual = await c.service.guardarFactura(c.contador, datos({ proveedorNombre: 'Corregido' }), f.id);
  assert.equal(actual.loteImportacionId, r.lote_id);
  await assert.rejects(c.service.guardarFactura(c.interno, datos({ fechaActualizacion: f.fechaActualizacion.toISOString() }), f.id), e => e.getStatus() === 409);
  assert.equal((await db.select().from(historialFactura).where(eq(historialFactura.facturaId, f.id))).length, 1);
});
test('Fallo del archivo conserva factura: reintentar documentación no crea otra', async t => {
  const c = await caso(t), f = await c.service.guardarFactura(c.interno, datos());
  c.storage.uploadFile = async () => { throw new Error('Storage simulado no disponible'); };
  const file = { filename: 'factura.pdf', buffer: Buffer.from('simulado') };
  await assert.rejects(c.service.uploadDocumento(c.interno, f.id, file, 'OTROS', 'Factura original'), /Storage simulado/);
  c.storage.uploadFile = async () => 'ficticio/factura.pdf';
  await c.service.uploadDocumento(c.interno, f.id, file, 'OTROS', 'Factura original');
  const d = await c.service.findOne(c.uid, f.id); assert.equal(d.documentos.length, 1); assert.equal(d.factura.estadoFactura, 'ACTIVA');
  assert.equal((await db.select().from(factura).where(eq(factura.empresaId, c.eid))).length, 1);
});
test('Datos inválidos y fecha imposible no crean facturas', async t => {
  const c = await caso(t);
  for (const extra of [{ proveedorRuc: '123' }, { fechaEmision: '2026-02-30' }, { numero: 'texto' }, { montoTotal: '1.001' }, { montoTotal: '-1' }, { moneda: 'EUR' }])
    await assert.rejects(c.service.guardarFactura(c.interno, datos(extra)), e => e.getStatus() === 400);
  const p = await c.importar([fila('1', '118', '20123456789', '30/02/2026')], true); assert.equal(p.errores, 1);
  // Columnas adicionales no deben convertir la moneda (columna 6) en el tipo.
  const headers = [...cabecera.slice(0, 7), ...Array.from({ length: 20 }, (_, i) => `Extra ${i}`)];
  const values = [...fila('103').slice(0, 7), ...Array(20).fill('')];
  const file = { filename: 'columnas-adicionales.csv', buffer: Buffer.from([headers, values].map(r => r.join(';')).join('\n')) };
  const imp = new ImportacionService(new PermisosService(), new NotificacionesService());
  assert.equal((await imp.importar(c.cid, 'CONTADOR_EXTERNO', c.eid, file, true)).revision.nuevas, 1);
  assert.equal((await db.select().from(factura).where(eq(factura.empresaId, c.eid))).length, 0);
});

test('HTTP real exige sesión/permisos; ambos perfiles crean/editan sin aceptar empresa/actor falsos', async t => {
  process.env.JWT_SECRET = 'clave-ficticia-exclusiva-ensayo-facturas-2026';
  const c = await caso(t), otra = await caso(t);
  const { crearAppFacturas } = require('./facturas-http.cjs');
  const { app, sesiones } = await crearAppFacturas(); t.after(() => app.close());
  const tokens = {};
  for (const uid of [c.uid, c.cid]) {
    const [u] = await db.select().from(usuario).where(eq(usuario.id, uid)); tokens[uid] = (await sesiones.crear(u)).access_token;
  }
  const peticion = (method, url, payload, uid = c.uid) => app.inject({ method, url, payload,
    headers: uid ? { authorization: `Bearer ${tokens[uid]}` } : {} });
  assert.equal((await peticion('POST', '/facturas', datos(), null)).statusCode, 401);
  const r = await peticion('POST', '/facturas', datos({ empresaId: otra.eid, creadoPor: otra.uid }));
  assert.equal(r.statusCode, 201); const f = r.json(); assert.equal(f.empresaId, c.eid); assert.equal(f.creadoPor, c.uid);
  assert.equal((await peticion('PATCH', `/contador/empresas/${c.eid}/facturas/${f.id}`, datos({ proveedorNombre: 'Editado HTTP' }), c.cid)).statusCode, 200);
  assert.equal((await peticion('POST', `/contador/empresas/${otra.eid}/facturas`, datos(), c.cid)).statusCode, 403);
  assert.equal((await peticion('POST', '/facturas', datos({ numero: '2' }), c.cid)).statusCode, 403);
  assert.equal((await peticion('POST', `/contador/empresas/${c.eid}/facturas`, datos({ numero: '2' }), c.cid)).statusCode, 201);
  await db.update(rol).set({ esInmutable: false }).where(eq(rol.id, c.rid));
  assert.equal((await peticion('PATCH', `/facturas/${f.id}`, datos())).statusCode, 403);
});

test('Pago y edición concurrentes esperan bloqueo real y conservan saldo/total', async t => {
  const c = await caso(t), f = await c.service.guardarFactura(c.interno, datos());
  let liberar, lista;
  const gate = new Promise(r => { liberar = r; }), ready = new Promise(r => { lista = r; });
  const bloqueo = db.transaction(async tx => {
    await tx.execute(sql`select id from factura where id = ${f.id} for update`); lista(); await gate;
  });
  await ready;
  const resultados = Promise.allSettled([
    c.service.guardarFactura(c.interno, datos({ montoTotal: '60', baseImponible: '', igv: '' }), f.id),
    c.service.registrarPago(c.contador, f.id, { montoPagado: 80, file: { filename: 'pago.pdf', buffer: Buffer.from('simulado') } }),
  ]);
  try {
    let n = 0;
    for (let i = 0; i < 150; i++) {
      const [row] = await db.execute(sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%for update%'`);
      n = row.n; if (n >= 2) break; await new Promise(r => setTimeout(r, 20));
    }
    assert.ok(n >= 2, 'Ambas operaciones deben esperar un bloqueo de fila real');
  } finally { liberar(); await bloqueo; }
  const r = await resultados; assert.equal(r.filter(r => r.status === 'fulfilled').length, 1);
  const d = await c.service.findOne(c.uid, f.id);
  assert.equal(Math.round(Number(d.factura.montoTotal) * 100), Math.round(Number(d.factura.saldoPendiente) * 100) + d.pagos.reduce((s, p) => s + Math.round(Number(p.montoPagado) * 100), 0));
});

test('Migración 0027 conserva duplicados normalizados históricos, sin borrar ni fusionar', async () => {
  const migration = readFileSync(path.resolve(__dirname, '../../../../packages/database/drizzle/0027_lame_blur.sql'), 'utf8');
  await client.begin(async tx => {
    await tx.unsafe('CREATE TEMP TABLE factura (id uuid default gen_random_uuid(), empresa_id uuid, serie text, numero text, proveedor_ruc text, proveedor_nombre text) ON COMMIT DROP');
    await tx.unsafe('CREATE TEMP TABLE permiso (codigo_permiso text unique, descripcion text) ON COMMIT DROP');
    await tx.unsafe('CREATE UNIQUE INDEX uq_factura_importacion_ruc ON factura (empresa_id, serie, numero, proveedor_ruc)');
    await tx.unsafe('CREATE UNIQUE INDEX uq_factura_importacion_nombre ON factura (empresa_id, serie, numero, proveedor_nombre) WHERE proveedor_ruc is null');
    const eid = randomUUID();
    await tx`insert into factura (empresa_id, serie, numero, proveedor_ruc, proveedor_nombre) values
      (${eid}, 'F001', '100', '20123456789', 'Uno'), (${eid}, ' f001 ', '000100', '20123456789', 'Dos'),
      (${eid}, 'F001', '101', '20123456789', 'Tres'), (${eid}, 'F001', '102', null, 'Sin RUC')`;
    for (const statement of migration.split('--> statement-breakpoint')) await tx.unsafe(statement);
    const fs = await tx.unsafe('select * from factura');
    assert.equal(fs.length, 4); assert.equal(fs.filter(f => f.clave_identidad).length, 1);
    assert.equal(fs.find(f => f.numero === '000100').serie, ' f001 ');
    assert.equal(fs.find(f => f.numero === '101').clave_identidad, '20123456789|01|F001|101');
  });
});

test('Fallo al guardar historial revierte la edición completa', async t => {
  const c = await caso(t), f = await c.service.guardarFactura(c.interno, datos());
  const nombre = 'ensayo_historial_' + randomUUID().replaceAll('-', '');
  await client.unsafe(`CREATE FUNCTION ${nombre}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.factura_id = '${f.id}' THEN RAISE EXCEPTION 'historial ficticio fallido'; END IF; RETURN NEW; END $$`);
  await client.unsafe(`CREATE TRIGGER ${nombre} BEFORE INSERT ON historial_factura FOR EACH ROW EXECUTE FUNCTION ${nombre}()`);
  try {
    await assert.rejects(c.service.guardarFactura(c.interno, datos({ proveedorNombre: 'No debe persistir' }), f.id), /historial/);
    const [guardada] = await db.select().from(factura).where(eq(factura.id, f.id));
    assert.equal(guardada.proveedorNombre, f.proveedorNombre);
    assert.equal((await db.select().from(historialFactura).where(eq(historialFactura.facturaId, f.id))).length, 1);
  } finally { await client.unsafe(`DROP TRIGGER ${nombre} ON historial_factura`); await client.unsafe(`DROP FUNCTION ${nombre}()`); }
});
