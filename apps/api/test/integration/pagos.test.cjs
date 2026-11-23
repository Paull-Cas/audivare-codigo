const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

// Solo una BD dedicada, local y explícita. No leer .env ni usar DATABASE_URL real.
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol)
  || destino.hostname !== '127.0.0.1' || !/^\/audivare_.*_test$/.test(destino.pathname)
  || destino.username !== 'audivare_test') {
  throw new Error('Configura AUDIVARE_TEST_DATABASE_URL para una BD local audivare_*_test del usuario audivare_test');
}
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = destino.href;
const { db, client, empresa, usuario, rol, usuarioInternoEmpresa, relacionEmpresaContador,
  factura, pagoFactura, historialFactura, notificacion, sesion, documentoSustento } = require('@audivare/database');
const { eq, sql } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { FacturasService } = require('../../dist/facturas/facturas.service');
const { EliminacionService } = require('../../dist/contadores/eliminacion.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const { NotificacionesService } = require('../../dist/notificaciones/notificaciones.service');

before(async () => {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') });
});
after(async () => { await client.end(); });

async function caso(t, montos = [], moneda = 'PEN') {
  const eid = randomUUID(), fid = randomUUID(), aid = randomUUID(), bid = randomUUID(), cid = randomUUID(), rid = randomUUID();
  const archivos = new Set(), borrados = [];
  const storage = {
    async uploadFile() { const key = `${randomUUID()}.pdf`; archivos.add(key); return key; },
    async deleteFile(key) { borrados.push(key); archivos.delete(key); },
  };
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test`, estadoSuscripcion: 'ACTIVO' });
  await db.insert(usuario).values([
    { id: aid, email: `${aid}@example.test`, tipoUsuario: 'INTERNO' },
    { id: bid, email: `${bid}@example.test`, tipoUsuario: 'INTERNO' },
    { id: cid, email: `${cid}@example.test`, tipoUsuario: 'CONTADOR_EXTERNO' },
  ]);
  await db.insert(rol).values({ id: rid, empresaId: eid, nombreRol: 'Administrador', esInmutable: true });
  await db.insert(usuarioInternoEmpresa).values([
    { usuarioId: aid, empresaId: eid, rolId: rid }, { usuarioId: bid, empresaId: eid, rolId: rid },
  ]);
  await db.insert(relacionEmpresaContador).values({ empresaId: eid, contadorId: cid });
  const saldo = 10000 - montos.reduce((s, m) => s + Math.round(m * 100), 0);
  await db.insert(factura).values({ id: fid, empresaId: eid, montoTotal: '100.00',
    saldoPendiente: (saldo / 100).toFixed(2), estadoFactura: saldo === 0 ? 'PAGADA' : 'ACTIVA', moneda, serie: 'F001', numero: '1' });
  const pagos = [];
  for (const monto of montos) {
    const id = randomUUID(), key = `${id}.pdf`;
    archivos.add(key);
    await db.insert(pagoFactura).values({ id, facturaId: fid, montoPagado: String(monto), comprobantePath: key,
      comprobanteNombre: 'original.pdf', registradoPor: aid });
    pagos.push(id);
  }
  t.after(async () => {
    await db.delete(empresa).where(eq(empresa.id, eid));
    for (const id of [aid, bid, cid]) await db.delete(usuario).where(eq(usuario.id, id));
  });
  const permisos = new PermisosService(), avisos = new NotificacionesService();
  const service = new FacturasService(storage, permisos, avisos);
  const interno = { kind: 'INTERNO', userId: aid };
  const contador = { kind: 'CONTADOR', userId: cid, empresaId: eid };
  const file = { filename: 'nuevo.pdf', mimetype: 'application/pdf', buffer: Buffer.from('simulado') };
  const registrar = (monto, actor = interno, tipoPago = 'NORMAL') => service.registrarPago(actor, fid, { montoPagado: monto, file, tipoPago });
  const editar = (id, monto, actor = interno, reemplazar = false) => service.actualizarPago(actor, fid, id,
    { montoPagado: monto, file: reemplazar ? file : null });
  const borrar = (id, actor = interno) => service.deletePago(actor, fid, id);
  const estado = async () => {
    const [f] = await db.select().from(factura).where(eq(factura.id, fid));
    const p = await db.select().from(pagoFactura).where(eq(pagoFactura.facturaId, fid));
    if (f) {
      const saldo = Math.round(Number(f.saldoPendiente) * 100);
      assert.equal(saldo + p.reduce((s, item) => s + Math.round(Number(item.montoPagado) * 100), 0), 10000);
      assert.ok(saldo >= 0);
      assert.equal(f.estadoFactura, saldo === 0 ? 'PAGADA' : 'ACTIVA');
    }
    return { f, p };
  };
  return { eid, fid, aid, bid, cid, interno, contador, service, permisos, avisos, pagos, archivos, borrados,
    registrar, editar, borrar, estado, eliminacion: new EliminacionService(permisos, avisos) };
}

// Una tercera conexión retiene la fila hasta comprobar en pg_stat_activity que
// ambas operaciones esperan. No depender de que dos promesas coincidan por azar.
async function simultaneas(fid, operaciones) {
  let liberar, listo;
  const espera = new Promise((r) => { liberar = r; });
  const preparada = new Promise((r) => { listo = r; });
  const bloqueo = client.begin(async (tx) => {
    await tx`select id from factura where id = ${fid} for update`;
    listo();
    await espera;
  });
  await Promise.race([preparada, bloqueo]);
  const resultado = Promise.allSettled(operaciones.map((fn) => fn()));
  try {
    const limite = Date.now() + 5000;
    let n = 0;
    while (Date.now() < limite) {
      const [row] = await client`select count(*)::int as n from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock' and query ilike '%for update%'`;
      n = row.n;
      if (n >= operaciones.length) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(n >= operaciones.length, 'Las operaciones deben coincidir esperando el bloqueo real');
  } finally { liberar(); await bloqueo; }
  return resultado;
}

test('Dos altas de empresa/contador no exceden saldo; solo una confirma y notifica', async (t) => {
  const c = await caso(t);
  const resultados = await simultaneas(c.fid, [() => c.registrar(70), () => c.registrar(70, c.contador)]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(resultados.find((r) => r.status === 'rejected').reason.message, /excede/);
  const { f, p } = await c.estado();
  assert.equal(f.saldoPendiente, '30.00'); assert.equal(p.length, 1);
  const h = await db.select().from(historialFactura).where(eq(historialFactura.facturaId, c.fid));
  assert.equal(h.length, 1);
  const avisos = await db.select().from(notificacion).where(sql`${notificacion.metadata}->>'factura_id' = ${c.fid}`);
  assert.ok(avisos.length >= 1); assert.ok(avisos.every((n) => n.mensaje.includes('Saldo pendiente: S/ 30.00')));
});

test('Pago normal y detracción concurrentes completan USD sin perder actualizaciones', async (t) => {
  const c = await caso(t, [], 'USD');
  const r = await simultaneas(c.fid, [() => c.registrar(60), () => c.registrar(40, c.contador, 'DETRACCION')]);
  assert.ok(r.every((item) => item.status === 'fulfilled'));
  const { f, p } = await c.estado(); assert.equal(f.saldoPendiente, '0.00'); assert.equal(f.moneda, 'USD');
  assert.deepEqual(p.map((item) => item.tipoPago).sort(), ['DETRACCION', 'NORMAL']);
});

test('Dos ediciones de pagos distintos validan el saldo disponible actualizado', async (t) => {
  const c = await caso(t, [20, 20]);
  const r = await simultaneas(c.fid, [() => c.editar(c.pagos[0], 60), () => c.editar(c.pagos[1], 60, c.contador)]);
  assert.equal(r.filter((item) => item.status === 'fulfilled').length, 1);
  assert.match(r.find((item) => item.status === 'rejected').reason.message, /excede/);
  const { f } = await c.estado(); assert.equal(f.saldoPendiente, '20.00');
});

test('Dos ediciones del mismo pago usan su importe vigente y conservan el comprobante final', async (t) => {
  const c = await caso(t, [20]);
  const r = await simultaneas(c.fid, [() => c.editar(c.pagos[0], 30, c.interno, true), () => c.editar(c.pagos[0], 40, c.contador, true)]);
  assert.ok(r.every((item) => item.status === 'fulfilled'));
  const { p } = await c.estado();
  assert.ok(['30.00', '40.00'].includes(p[0].montoPagado));
  assert.deepEqual([...c.archivos], [p[0].comprobantePath]);
  assert.equal(c.borrados.length, 2);
});

test('Borrado repetido reintegra el importe una sola vez', async (t) => {
  const c = await caso(t, [100]);
  const r = await simultaneas(c.fid, [() => c.borrar(c.pagos[0]), () => c.borrar(c.pagos[0], c.contador)]);
  assert.equal(r.filter((item) => item.status === 'fulfilled').length, 1);
  assert.match(r.find((item) => item.status === 'rejected').reason.message, /Pago no encontrado/);
  const { f, p } = await c.estado(); assert.equal(f.saldoPendiente, '100.00'); assert.equal(p.length, 0);
  assert.equal(c.borrados.length, 1);
});

test('Edición y borrado del mismo pago dejan saldo correcto en cualquier orden', async (t) => {
  const c = await caso(t, [20]);
  const r = await simultaneas(c.fid, [() => c.editar(c.pagos[0], 30), () => c.borrar(c.pagos[0], c.contador)]);
  assert.equal(r[1].status, 'fulfilled');
  if (r[0].status === 'rejected') assert.match(r[0].reason.message, /Pago no encontrado/);
  const { f, p } = await c.estado(); assert.equal(f.saldoPendiente, '100.00'); assert.equal(p.length, 0);
});

test('Alta y borrado de otro pago no pierden el saldo reintegrado', async (t) => {
  const c = await caso(t, [20]);
  const r = await simultaneas(c.fid, [() => c.registrar(30), () => c.borrar(c.pagos[0], c.contador)]);
  assert.ok(r.every((item) => item.status === 'fulfilled'));
  const { f, p } = await c.estado(); assert.equal(f.saldoPendiente, '70.00'); assert.equal(p.length, 1);
});

test('Fallo de notificación revierte pago, saldo e historial; conserva subida para conciliación', async (t) => {
  const c = await caso(t);
  t.mock.method(c.avisos, 'crearNotificacion', async () => { throw new Error('fallo simulado'); });
  await assert.rejects(c.registrar(50), /fallo simulado/);
  const { f, p } = await c.estado(); assert.equal(f.saldoPendiente, '100.00'); assert.equal(p.length, 0);
  assert.equal((await db.select().from(historialFactura).where(eq(historialFactura.facturaId, c.fid))).length, 0);
  assert.equal(c.archivos.size, 1); assert.equal(c.borrados.length, 0);
});

test('Empresa ajena no puede modificar ni bloquear pagos de otra factura', async (t) => {
  const c = await caso(t, [20]), ajena = await caso(t);
  await assert.rejects(c.service.actualizarPago(ajena.interno, c.fid, c.pagos[0], { montoPagado: 30, file: null }), /No tiene acceso/);
  await assert.rejects(c.service.deletePago(ajena.contador, c.fid, c.pagos[0]), /No tiene acceso/);
  await c.estado();
});

test('Una factura independiente sigue operando mientras otra está bloqueada', async (t) => {
  const c = await caso(t), otra = await caso(t);
  let liberar, listo;
  const espera = new Promise((r) => { liberar = r; }), preparada = new Promise((r) => { listo = r; });
  const bloqueo = client.begin(async (tx) => { await tx`select id from factura where id = ${c.fid} for update`; listo(); await espera; });
  await Promise.race([preparada, bloqueo]);
  let timeout;
  try {
    await Promise.race([otra.registrar(10), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Bloqueo global inesperado')), 3000); })]);
    await otra.estado();
  } finally { clearTimeout(timeout); liberar(); await bloqueo; }
});

test('Borrado de factura revalida pagos recibidos tras clasificarla como libre', async (t) => {
  const c = await caso(t);
  await c.registrar(10);
  await assert.rejects(c.eliminacion.ejecutarBorrado(c.cid, c.eid, [{ id: c.fid, serie: 'F001', numero: '1' }]), /recibió documentos o pagos/);
  const { p } = await c.estado(); assert.equal(p.length, 1);
});

test('Borrado de factura revalida también documentos recién recibidos', async (t) => {
  const c = await caso(t);
  await db.insert(documentoSustento).values({ facturaId: c.fid, tipoDocumento: 'CONTRATO',
    archivoStoragePath: 'simulado.pdf', archivoNombreOriginal: 'simulado.pdf', subidoPor: c.aid });
  await assert.rejects(c.eliminacion.ejecutarBorrado(c.cid, c.eid, [{ id: c.fid, serie: 'F001', numero: '1' }]), /recibió documentos o pagos/);
  assert.equal((await db.select().from(documentoSustento).where(eq(documentoSustento.facturaId, c.fid))).length, 1);
  await c.estado();
});

test('Borrado de factura libre funciona y repetir una selección obsoleta cuenta cero', async (t) => {
  const c = await caso(t);
  const resultado = await c.eliminacion.eliminarFactura(c.cid, 'CONTADOR_EXTERNO', c.eid, c.fid);
  assert.deepEqual(resultado, { eliminadas: 1, conservadas: [] });
  assert.equal((await c.estado()).f, undefined);
  assert.equal(await c.eliminacion.ejecutarBorrado(c.cid, c.eid, [{ id: c.fid, serie: 'F001', numero: '1' }]), 0);
});

test('Migración 0015 permite registrar sesiones sin ejecutar seed', async (t) => {
  const c = await caso(t);
  await db.insert(sesion).values({ usuarioId: c.aid, fechaExpiracion: new Date(Date.now() + 60000) });
  assert.equal((await db.select().from(sesion).where(eq(sesion.usuarioId, c.aid))).length, 1);
});

test('Importes fraccionarios de céntimo/no finitos se rechazan antes de subir archivos', async (t) => {
  const c = await caso(t, [20]);
  for (const monto of [NaN, Infinity, -1, 0, 0.001, 1.005]) {
    await assert.rejects(c.registrar(monto), /dos decimales/);
    await assert.rejects(c.editar(c.pagos[0], monto, c.interno, true), /dos decimales/);
  }
  assert.equal(c.archivos.size, 1); assert.equal(c.borrados.length, 0);
  await c.estado();
});

test('Pagos decimales concurrentes conservan céntimos exactos', async (t) => {
  const c = await caso(t);
  const r = await simultaneas(c.fid, [() => c.registrar(0.29), () => c.registrar(0.57, c.contador)]);
  assert.ok(r.every((item) => item.status === 'fulfilled'));
  const { f } = await c.estado(); assert.equal(f.saldoPendiente, '99.14');
});
