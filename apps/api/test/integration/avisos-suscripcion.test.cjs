const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
const { db, client, empresa, usuario, rol, usuarioInternoEmpresa, pagoSuscripcion, notificacion, suscripcionAviso } = require('@audivare/database');
const { eq, sql, inArray } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { SuscripcionesService } = require('../../dist/superadmin/suscripciones.service');
const { NotificacionesService } = require('../../dist/notificaciones/notificaciones.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
const ahora = new Date('2026-10-08T17:00:00Z');
async function caso(t, patch = {}) {
  const eid = randomUUID(), admin = randomUUID(), interno = randomUUID(), excluido = randomUUID();
  await db.insert(empresa).values({ id: eid, emailRegistro: `${eid}@example.test`, razonSocial: 'Empresa ficticia',
    pruebaHasta: new Date(ahora.getTime() - 1000), fechaCreacion: new Date('2026-01-01'), ...patch });
  await db.insert(usuario).values([
    { id: admin, email: `${admin}@example.test`, tipoUsuario: 'SUPERADMIN', esSuperadminPrincipal: true },
    { id: interno, email: `${interno}@example.test`, tipoUsuario: 'INTERNO' },
    { id: excluido, email: `${excluido}@example.test`, tipoUsuario: 'INTERNO' },
  ]);
  const [r] = await db.insert(rol).values({ empresaId: eid, nombreRol: 'Administrador de prueba', esInmutable: true }).returning();
  await db.insert(usuarioInternoEmpresa).values([
    { empresaId: eid, usuarioId: interno, rolId: r.id, estado: true },
    { empresaId: eid, usuarioId: excluido, rolId: r.id, estado: false },
  ]);
  t.after(async () => { await db.delete(pagoSuscripcion).where(eq(pagoSuscripcion.empresaId, eid)); await db.delete(usuario).where(inArray(usuario.id, [admin, interno, excluido])); await db.delete(empresa).where(eq(empresa.id, eid)); });
  const permisos = new PermisosService(), notifier = new NotificacionesService();
  const service = new SuscripcionesService(notifier, permisos);
  const avisos = () => db.select().from(suscripcionAviso).where(eq(suscripcionAviso.empresaId, eid));
  const mensajes = () => db.select().from(notificacion).where(sql`${notificacion.metadata}->>'empresa_id' = ${eid}`);
  const pago = async (fechaPago = '2026-08-01') => {
    const [p] = await db.insert(pagoSuscripcion).values({ empresaId: eid, monto: '0.00', fechaPago, duracionMeses: 1, registradoPor: admin }).returning(); return p;
  };
  return { eid, admin, interno, excluido, service, notifier, permisos, avisos, mensajes, pago };
}

test('Prueba vencida: una notificación por destinatario y ciclo incluso con revisiones concurrentes', async t => {
  const c = await caso(t);
  await Promise.all(Array.from({ length: 8 }, () => c.service.revisarEmpresaVencimiento(c.eid, ahora)));
  assert.equal((await c.avisos()).length, 1); const mensajes = await c.mensajes(); assert.equal(mensajes.length, 2);
  assert.deepEqual(new Set(mensajes.map(n => n.usuarioId)), new Set([c.admin, c.interno]));
  assert.ok(mensajes.every(n => n.metadata.origen_acceso === 'PRUEBA' && n.metadata.etapa_acceso === 'BLOQUEADO'));
  assert.ok(mensajes.every(n => /siete días/.test(n.titulo)));
  const [emp] = await db.select().from(empresa).where(eq(empresa.id, c.eid));
  assert.equal(emp.estadoSuscripcion, 'ACTIVO'); assert.equal(emp.suspendidaPorPago, false);
  await new SuscripcionesService(c.notifier, c.permisos).revisarEmpresaVencimiento(c.eid, ahora); assert.equal((await c.mensajes()).length, 2);
});
test('Periodo pagado tiene dos etapas idempotentes; recuperación tras apagado avisa solo estado actual', async t => {
  const c = await caso(t); const p = await c.pago('2026-09-01');
  await db.update(empresa).set({ pruebaHasta: new Date('2026-08-01') }).where(eq(empresa.id, c.eid));
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-10-01T05:00:00Z'));
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-10-08T05:00:00Z'));
  await c.service.revisarEmpresaVencimiento(c.eid, ahora);
  assert.deepEqual(new Set((await c.avisos()).map(a => a.etapa)), new Set(['VENCIDO', 'BLOQUEADO']));
  assert.equal((await c.mensajes()).length, 4);
  assert.ok((await c.mensajes()).every(n => n.metadata.ciclo_suscripcion === `pago:${p.id}`));
  await c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 1);
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-11-01T05:00:00Z'));
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-11-08T05:00:00Z'));
  assert.equal((await c.avisos()).length, 4); assert.equal((await c.mensajes()).length, 8);
  const d = await caso(t); await d.pago('2026-08-01');
  await db.update(empresa).set({ pruebaHasta: new Date('2026-07-01') }).where(eq(empresa.id, d.eid));
  await d.service.revisarEmpresaVencimiento(d.eid, ahora); assert.equal((await d.avisos()).length, 1);
  assert.equal((await d.avisos())[0].etapa, 'BLOQUEADO');
});
test('Fallo de creación de notificación revierte marcador y todas las notificaciones', async t => {
  const c = await caso(t); let count = 0;
  const service = new SuscripcionesService({ crearNotificacion: async (...args) => {
    if (++count === 2) throw new Error('Fallo ficticio'); return c.notifier.crearNotificacion(...args);
  } }, c.permisos);
  await assert.rejects(service.revisarEmpresaVencimiento(c.eid, ahora), /Fallo ficticio/);
  assert.equal((await c.avisos()).length, 0); assert.equal((await c.mensajes()).length, 0);
  await c.service.revisarEmpresaVencimiento(c.eid, ahora); assert.equal((await c.mensajes()).length, 2);
});
test('Suspensión manual no avisa por vencimiento y pago no la revierte', async t => {
  const c = await caso(t, { estadoSuscripcion: 'SUSPENDIDO', suspendidaPorPago: false });
  await c.service.revisarEmpresaVencimiento(c.eid, ahora); assert.equal((await c.avisos()).length, 0);
  await c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 1);
  assert.equal((await db.select().from(empresa).where(eq(empresa.id, c.eid)))[0].estadoSuscripcion, 'SUSPENDIDO');
  await c.service.revisarEmpresaVencimiento(c.eid, ahora); assert.equal((await c.mensajes()).length, 0);
});
test('Modelo anterior conserva aviso y suspensión/reactivación, sin repetir avisos ya emitidos', async t => {
  const c = await caso(t, { pruebaHasta: null, fechaCreacion: new Date('2026-09-01T12:00:00Z') });
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-10-02T12:00:00Z'));
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-10-09T12:00:00Z'));
  const [emp] = await db.select().from(empresa).where(eq(empresa.id, c.eid));
  assert.equal(emp.estadoSuscripcion, 'SUSPENDIDO'); assert.equal(emp.suspendidaPorPago, true);
  assert.equal((await c.avisos()).length, 2); assert.equal((await c.mensajes()).length, 4);
  await db.update(empresa).set({ estadoSuscripcion: 'ACTIVO', suspendidaPorPago: false }).where(eq(empresa.id, c.eid));
  await c.service.revisarEmpresaVencimiento(c.eid, new Date('2026-10-09T12:00:00Z'));
  assert.equal((await db.select().from(empresa).where(eq(empresa.id, c.eid)))[0].estadoSuscripcion, 'SUSPENDIDO');
  assert.equal((await c.mensajes()).length, 4);
  assert.equal((await c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 1)).reactivada, true);
  const d = await caso(t, { pruebaHasta: null, fechaCreacion: new Date('2026-09-01T12:00:00Z'), ultimoAvisoPago: new Date('2026-10-02T12:00:00Z') });
  await d.service.revisarEmpresaVencimiento(d.eid, new Date('2026-10-03T12:00:00Z')); assert.equal((await d.mensajes()).length, 0);
});

test('Revisión general continúa tras fallo de una empresa y recupera solo su aviso pendiente', async t => {
  const c = await caso(t, { pruebaHasta: new Date(Date.now() - 5000) });
  const d = await caso(t, { pruebaHasta: new Date(Date.now() - 5000) });
  const service = new SuscripcionesService({ crearNotificacion: async (...args) => {
    if (args[4].empresa_id === c.eid) throw new Error('Fallo ficticio de una empresa');
    return c.notifier.crearNotificacion(...args);
  } }, c.permisos);
  service.logger = { error() {} };
  await service.revisarVencimientos();
  assert.equal((await c.avisos()).length, 0); assert.equal((await d.avisos()).length, 1);
  const count = (await d.mensajes()).length;
  await c.service.revisarVencimientos();
  assert.equal((await c.avisos()).length, 1); assert.equal((await d.mensajes()).length, count);
});

async function esperarBloqueado(token) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const rows = await db.execute(sql`select 1 from pg_stat_activity where application_name = ${token} and wait_event_type = 'Lock'`);
    if (rows.length) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('No se observó espera por bloqueo real');
}
test('Aviso que espera pago reconsulta tras bloqueo y no anuncia vencimiento antiguo', async t => {
  const c = await caso(t), token = `sub-${randomUUID()}`;
  let liberar, listo;
  const gate = new Promise(resolve => liberar = resolve), ready = new Promise(resolve => listo = resolve);
  const blocker = db.transaction(async tx => {
    await tx.select().from(empresa).where(eq(empresa.id, c.eid)).for('update'); listo(); await gate;
    await tx.insert(pagoSuscripcion).values({ empresaId: c.eid, registradoPor: c.admin, monto: '0.00', fechaPago: '2026-10-01', duracionMeses: 1 });
  });
  await ready;
  // Identificar la conexión esperante sin modificar el servicio ni simular la BD.
  const original = db.transaction.bind(db);
  db.transaction = fn => original(async tx => { await tx.execute(sql`select set_config('application_name', ${token}, true)`); return fn(tx); });
  const waiting = c.service.revisarEmpresaVencimiento(c.eid, ahora);
  try { await esperarBloqueado(token); } finally { liberar(); db.transaction = original; }
  await blocker; await waiting; assert.equal((await c.mensajes()).length, 0); assert.equal((await c.avisos()).length, 0);
});
test('Pago que espera suspensión manual conserva estado manual al obtener bloqueo', async t => {
  const c = await caso(t, { estadoSuscripcion: 'PENDIENTE' }), token = `sub-${randomUUID()}`;
  let liberar, listo;
  const gate = new Promise(resolve => liberar = resolve), ready = new Promise(resolve => listo = resolve);
  const blocker = db.transaction(async tx => {
    await tx.select().from(empresa).where(eq(empresa.id, c.eid)).for('update'); listo(); await gate;
    await tx.update(empresa).set({ estadoSuscripcion: 'SUSPENDIDO', suspendidaPorPago: false }).where(eq(empresa.id, c.eid));
  });
  await ready; const original = db.transaction.bind(db);
  db.transaction = fn => original(async tx => { await tx.execute(sql`select set_config('application_name', ${token}, true)`); return fn(tx); });
  const waiting = c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 1);
  try { await esperarBloqueado(token); } finally { liberar(); db.transaction = original; }
  await blocker; const result = await waiting; assert.equal(result.activada, false); assert.equal(result.reactivada, false);
  assert.equal((await db.select().from(empresa).where(eq(empresa.id, c.eid)))[0].estadoSuscripcion, 'SUSPENDIDO');
});

test('Pago confirmado más tarde prevalece aunque su transacción empezara antes', async t => {
  const c = await caso(t);
  let liberar, listo, llamadas = 0;
  const gate = new Promise(resolve => liberar = resolve), ready = new Promise(resolve => listo = resolve);
  const original = db.transaction.bind(db);
  db.transaction = fn => original(async tx => {
    if (++llamadas === 1) { await tx.execute(sql`select transaction_timestamp()`); listo(); await gate; }
    return fn(tx);
  });
  const waiting = c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 3);
  try { await ready; await c.service.registrarPago(c.admin, c.eid, 0, '2026-10-01', 1); }
  finally { liberar(); db.transaction = original; }
  const result = await waiting; assert.equal(result.ciclo.ultimo_pago.duracion_meses, 3);
  assert.equal((await c.service.getCiclo(c.eid, null, new Date('2026-10-01'))).ultimo_pago.duracion_meses, 3);
});
