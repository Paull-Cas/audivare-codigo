const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
process.env.JWT_SECRET = 'secreto-ficticio-exclusivo-de-integracion';
const { db, client, empresa, usuario, rol, sesion, usuarioInternoEmpresa, factura, loteImportacion, notificacion, relacionEmpresaContador } = require('@audivare/database');
const { eq, sql } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../../dist/auth/auth.service');
const { SesionesService } = require('../../dist/auth/sesiones.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const { NotificacionesService } = require('../../dist/notificaciones/notificaciones.service');
const { ImportacionService } = require('../../dist/contadores/importacion.service');
const permisos = new PermisosService(), avisos = new NotificacionesService();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const nuevoRuc = () => '20' + BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)).toString().slice(-9).padStart(9, '0');
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
function auth(email, notifs = avisos, signer = jwt) {
  const service = new AuthService(new SesionesService(signer, permisos), notifs, permisos);
  service.verificarCredencialGoogle = async () => ({ email, nombre: 'Prueba Local' });
  return service;
}
const dto = (ruc) => ({ tipo: 'EMPRESA', credential: 'fixture', nombre_completo: 'Prueba Local', ruc, razon_social: 'Ficticia',
  acepta_terminos: true, privacidad_leida: true, declara_representacion: true, version_legal: require('../../dist/auth/aceptacion-legal').VERSION_LEGAL });
function limpiar(t, emails, rucs) { t.after(async () => {
  for (const ruc of rucs) await db.delete(empresa).where(eq(empresa.ruc, ruc));
  for (const email of emails) await db.delete(usuario).where(eq(usuario.email, email));
}); }
test('Dos registros con mismo email: solo una empresa, rol, vínculo y sesión', async t => {
  const email = `${randomUUID()}@example.test`, rucs = [nuevoRuc(), nuevoRuc()]; limpiar(t, [email], rucs);
  const results = await Promise.allSettled(rucs.map(ruc => auth(email).googleRegistro(dto(ruc))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const [user] = await db.select().from(usuario).where(eq(usuario.email, email));
  const vinculos = await db.select().from(usuarioInternoEmpresa).where(eq(usuarioInternoEmpresa.usuarioId, user.id));
  assert.equal(vinculos.length, 1);
  assert.equal((await db.select().from(rol).where(eq(rol.empresaId, vinculos[0].empresaId))).length, 1);
  assert.equal((await db.select().from(sesion).where(eq(sesion.usuarioId, user.id))).length, 1);
});
test('Dos emails con mismo RUC: solo uno registra; el perdedor no deja cuenta', async t => {
  const emails = [randomUUID(), randomUUID()].map(id => `${id}@example.test`), ruc = nuevoRuc(); limpiar(t, emails, [ruc]);
  const results = await Promise.allSettled(emails.map(email => auth(email).googleRegistro(dto(ruc))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(empresa).where(eq(empresa.ruc, ruc))).length, 1);
  let users = 0; for (const email of emails) users += (await db.select().from(usuario).where(eq(usuario.email, email))).length;
  assert.equal(users, 1);
});
test('Doce registros contendientes no agotan el pool ni crean cuentas parciales', { timeout: 15000 }, async t => {
  const email = `${randomUUID()}@example.test`, rucs = Array.from({ length: 12 }, nuevoRuc); limpiar(t, [email], rucs);
  const results = await Promise.allSettled(rucs.map(ruc => auth(email).googleRegistro(dto(ruc))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('Dos conversiones de cuenta huérfana no la vinculan a dos empresas', async t => {
  const email = `${randomUUID()}@example.test`, rucs = [nuevoRuc(), nuevoRuc()]; limpiar(t, [email], rucs);
  const [user] = await db.insert(usuario).values({ email, tipoUsuario: 'INTERNO' }).returning();
  const results = await Promise.allSettled(rucs.map(ruc => auth(email).googleRegistro(dto(ruc))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(usuarioInternoEmpresa).where(eq(usuarioInternoEmpresa.usuarioId, user.id))).length, 1);
});
test('Fallo de firma revierte empresa, usuario y sesión; permite reintentar', async t => {
  const email = `${randomUUID()}@example.test`, ruc = nuevoRuc(); limpiar(t, [email], [ruc]);
  await assert.rejects(auth(email, avisos, { signAsync: async () => { throw new Error('firma fallida'); } }).googleRegistro(dto(ruc)), /firma fallida/);
  assert.equal((await db.select().from(empresa).where(eq(empresa.ruc, ruc))).length, 0);
  assert.equal((await db.select().from(usuario).where(eq(usuario.email, email))).length, 0);
  assert.ok((await auth(email).googleRegistro(dto(ruc))).access_token);
});
test('Fallo de aviso revierte registro y restaura cuenta huérfana', async t => {
  const email = `${randomUUID()}@example.test`, adminEmail = `${randomUUID()}@example.test`, ruc = nuevoRuc(); limpiar(t, [email, adminEmail], [ruc]);
  await db.insert(usuario).values({ email: adminEmail, tipoUsuario: 'SUPERADMIN', esSuperadminPrincipal: true });
  await db.insert(usuario).values({ email, tipoUsuario: 'INTERNO', nombreCompleto: 'Anterior' });
  await assert.rejects(auth(email, { crearNotificacion: async () => { throw new Error('aviso fallido'); } }).googleRegistro(dto(ruc)), /aviso fallido/);
  assert.equal((await db.select().from(empresa).where(eq(empresa.ruc, ruc))).length, 0);
  const [user] = await db.select().from(usuario).where(eq(usuario.email, email));
  assert.equal(user.nombreCompleto, 'Anterior');
  assert.equal((await db.select().from(usuarioInternoEmpresa).where(eq(usuarioInternoEmpresa.usuarioId, user.id))).length, 0);
});
test('Registro de contador también revierte si no puede crear sesión', async t => {
  const email = `${randomUUID()}@example.test`; limpiar(t, [email], []);
  await assert.rejects(auth(email, avisos, { signAsync: async () => { throw new Error('firma fallida'); } })
    .googleRegistro({ ...dto(), tipo: 'CONTADOR' }), /firma fallida/);
  assert.equal((await db.select().from(usuario).where(eq(usuario.email, email))).length, 0);
});
async function importacion(t, notifs = avisos) {
  const id = randomUUID(), cid = randomUUID(), uid = randomUUID(), rid = randomUUID();
  await db.insert(empresa).values({ id, emailRegistro: `${id}@example.test` });
  await db.insert(usuario).values([{ id: cid, email: `${cid}@example.test`, tipoUsuario: 'CONTADOR_EXTERNO' }, { id: uid, email: `${uid}@example.test`, tipoUsuario: 'INTERNO' }]);
  await db.insert(rol).values({ id: rid, empresaId: id, nombreRol: 'Administrador', esInmutable: true });
  await db.insert(usuarioInternoEmpresa).values({ usuarioId: uid, empresaId: id, rolId: rid });
  await db.insert(relacionEmpresaContador).values({ empresaId: id, contadorId: cid });
  t.after(async () => { await db.delete(empresa).where(eq(empresa.id, id)); for (const u of [cid, uid]) await db.delete(usuario).where(eq(usuario.id, u)); });
  const service = new ImportacionService(permisos, notifs);
  return { id, cid, uid, run: file => service.importar(cid, 'CONTADOR_EXTERNO', id, file) };
}
const cabecera = ['Fecha de Emision', 'Serie', 'Nro CP o Doc. Nro Inicial (Rango)', 'Nro Doc Identidad', 'Apellidos Nombres/ Razon Social', 'Total CP', 'Moneda'];
const fila = (numero = '1', ruc = '20123456789', nombre = 'Proveedor', monto = '10.00') => ['08/10/2026', 'F001', numero, ruc, nombre, monto, 'PEN'];
const csv = filas => ({ filename: 'test.csv', mimetype: 'text/csv', buffer: Buffer.from([cabecera, ...filas].map(r => r.join(';')).join('\n')) });
test('CSV/XLSX concurrentes solapados no duplican; reimportación no sobrescribe', async t => {
  const c = await importacion(t);
  const ExcelJS = require('exceljs'), libro = new ExcelJS.Workbook(); libro.addWorksheet('SUNAT').addRows([cabecera, fila('2'), fila('1')]);
  const excel = { filename: 'test.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await libro.xlsx.writeBuffer()) };
  const results = await Promise.all([c.run(csv([fila('1'), fila('2')])), c.run(excel)]);
  assert.equal(results.reduce((s, r) => s + r.creadas, 0), 2); assert.equal(results.reduce((s, r) => s + r.omitidas, 0), 2);
  assert.equal((await db.select().from(loteImportacion).where(eq(loteImportacion.empresaId, c.id))).length, 1);
  assert.equal((await c.run(csv([fila('1', '20123456789', 'Cambio', '99.00')]))).creadas, 0);
  const facturas = await db.select().from(factura).where(eq(factura.empresaId, c.id));
  assert.equal(facturas.length, 2); assert.equal(facturas[0].montoTotal, '10.00');
  assert.equal((await db.select().from(notificacion).where(eq(notificacion.usuarioId, c.uid))).length, 1);
});
test('Sin RUC exige revisión; con RUC usa identidad fiscal; otra empresa es independiente', async t => {
  const a = await importacion(t), b = await importacion(t);
  const file = csv([fila('1', '', 'Uno'), fila('1', '', 'Uno'), fila('1', '', 'Dos'), fila('1', '20123456789', 'Uno')]);
  const results = await Promise.all([a.run(file), a.run(file)]);
  assert.equal(results[0].creadas + results[1].creadas, 1);
  assert.equal(results[0].revision.identidadInsuficiente, 3);
  // SEG-01 permite dos importaciones simultáneas por proceso; verificar la otra empresa después.
  assert.equal((await b.run(file)).creadas, 1);
});
test('Fallo al notificar revierte lote/facturas y permite reimportar', async t => {
  const c = await importacion(t, { crearNotificacion: async () => { throw new Error('aviso fallido'); } });
  await assert.rejects(c.run(csv([fila()])), /aviso fallido/);
  assert.equal((await db.select().from(factura).where(eq(factura.empresaId, c.id))).length, 0);
  assert.equal((await db.select().from(loteImportacion).where(eq(loteImportacion.empresaId, c.id))).length, 0);
  const service = new ImportacionService(permisos, avisos);
  assert.equal((await service.importar(c.cid, 'CONTADOR_EXTERNO', c.id, csv([fila()]))).creadas, 1);
});
test('Índice impide duplicar factura incluso fuera del importador', async t => {
  const c = await importacion(t); await c.run(csv([fila()]));
  await assert.rejects(db.insert(factura).values({ empresaId: c.id, serie: 'F001', numero: '1', proveedorRuc: '20123456789' }),
    e => (e.cause?.code || e.code) === '23505');
});
test('Importación esperando otra vuelve a comprobar acceso antes de crear lote', async t => {
  const c = await importacion(t);
  let liberar, adquirida;
  const gate = new Promise(resolve => { liberar = resolve; });
  const listo = new Promise(resolve => { adquirida = resolve; });
  const bloqueo = db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'importacion:' + c.id}, 0))`);
    adquirida(); await gate;
  });
  await listo;
  const operacion = c.run(csv([fila()]));
  const resultado = assert.rejects(operacion, e => e.getStatus() === 403);
  try {
    let esperando = false;
    for (let i = 0; i < 100; i++) {
      const rows = await db.execute(sql`select count(*)::int as n from pg_stat_activity where wait_event = 'advisory'`);
      if (rows[0].n > 0) { esperando = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(esperando, 'La importación debe esperar el bloqueo PostgreSQL');
    await db.update(empresa).set({ estadoSuscripcion: 'SUSPENDIDO' }).where(eq(empresa.id, c.id));
  } finally { liberar(); await bloqueo; }
  await resultado;
  assert.equal((await db.select().from(loteImportacion).where(eq(loteImportacion.empresaId, c.id))).length, 0);
});
for (const tipo of ['ruc', 'factura-ruc', 'factura-nombre']) test(`Migración ante duplicados ${tipo}: falla sin borrar filas`, async () => {
  const migration = readFileSync(path.resolve(__dirname, '../../../../packages/database/drizzle/0017_superb_stingray.sql'), 'utf8');
  await client.begin(async connection => {
    await connection.unsafe('CREATE TEMP TABLE empresa (ruc text) ON COMMIT DROP');
    await connection.unsafe('CREATE TEMP TABLE factura (empresa_id text, serie text, numero text, proveedor_ruc text, proveedor_nombre text) ON COMMIT DROP');
    await connection.unsafe(`INSERT INTO empresa VALUES ('A'), ('${tipo === 'ruc' ? 'A' : 'B'}')`);
    await connection.unsafe(`INSERT INTO factura VALUES ('E','S','N',${tipo === 'factura-nombre' ? 'NULL' : "'R'"},'Nombre'), ('E','S','N',${tipo === 'factura-nombre' ? 'NULL' : "'R'"},'Nombre')`);
    await assert.rejects(connection.savepoint(async attempt => {
      for (const statement of migration.split('--> statement-breakpoint')) await attempt.unsafe(statement);
    }), e => e.code === '23505');
    assert.equal((await connection.unsafe('SELECT count(*) AS n FROM empresa'))[0].n, '2');
    assert.equal((await connection.unsafe('SELECT count(*) AS n FROM factura'))[0].n, '2');
  });
});
