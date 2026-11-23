const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const destino = new URL(process.env.AUDIVARE_TEST_DATABASE_URL || 'http://sin-destino');
if (!['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1'
  || !/^\/audivare_.*_test$/.test(destino.pathname) || destino.username !== 'audivare_test') throw new Error('Solo BD local dedicada audivare_*_test');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = destino.href;
process.env.JWT_SECRET = 'secreto-ficticio-exclusivo-de-integracion';
const { db, client, empresa, usuario, relacionEmpresaContador } = require('@audivare/database');
const { eq } = require('drizzle-orm');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { JwtService } = require('@nestjs/jwt');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const { SesionesService } = require('../../dist/auth/sesiones.service');
const { AuthService } = require('../../dist/auth/auth.service');
const { SuscripcionesService } = require('../../dist/superadmin/suscripciones.service');
const { SuperadminService } = require('../../dist/superadmin/superadmin.service');
const { ExportContadorService } = require('../../dist/contadores/export-contador.service');
const { DocumentosEmpresaService } = require('../../dist/documentos-empresa/documentos-empresa.service');
const permisos = new PermisosService();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const sesiones = new SesionesService(jwt, permisos);
const auth = new AuthService(sesiones, { crearNotificacion: async () => {} }, permisos);
const suscripciones = new SuscripcionesService({}, permisos);
before(() => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../../packages/database/drizzle') }));
after(() => client.end());
async function registro(t) {
  const email = `${randomUUID()}@example.test`, ruc = '20' + String(Date.now()).slice(-9);
  auth.verificarCredencialGoogle = async () => ({ email, nombre: 'Prueba Local' });
  const response = await auth.googleRegistro({ tipo: 'EMPRESA', credential: 'fixture', nombre_completo: 'Prueba Local', ruc, razon_social: 'Empresa ficticia',
    acepta_terminos: true, privacidad_leida: true, declara_representacion: true, version_legal: require('../../dist/auth/aceptacion-legal').VERSION_LEGAL });
  const [emp] = await db.select().from(empresa).where(eq(empresa.emailRegistro, email));
  const [user] = await db.select().from(usuario).where(eq(usuario.email, email));
  t.after(async () => { await db.delete(empresa).where(eq(empresa.id, emp.id)); await db.delete(usuario).where(eq(usuario.id, user.id)); });
  return { emp, user, response, ruc };
}
test('Registro real en BD concede 168 horas y sesión; login no reinicia prueba', async t => {
  const c = await registro(t);
  assert.equal(c.emp.pruebaHasta - c.emp.fechaCreacion, 168 * 3600000);
  assert.ok(c.response.access_token); assert.equal(c.response.pendiente_activacion, undefined);
  await sesiones.validar(jwt.decode(c.response.access_token));
  await auth.login(c.user.email, '', true);
  const [actual] = await db.select().from(empresa).where(eq(empresa.id, c.emp.id));
  assert.equal(actual.pruebaHasta.getTime(), c.emp.pruebaHasta.getTime());
});
test('Vencimiento bloquea sesión abierta/login/exportaciones/descarga de contador; logout permite revocar', async t => {
  const c = await registro(t), contadorId = randomUUID();
  await db.insert(usuario).values({ id: contadorId, email: `${contadorId}@example.test`, tipoUsuario: 'CONTADOR_EXTERNO' });
  t.after(() => db.delete(usuario).where(eq(usuario.id, contadorId)));
  await db.insert(relacionEmpresaContador).values({ empresaId: c.emp.id, contadorId });
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() - 1000) }).where(eq(empresa.id, c.emp.id));
  await assert.rejects(sesiones.validar(jwt.decode(c.response.access_token)), e => e.getStatus() === 403);
  await assert.rejects(auth.login(c.user.email, '', true), e => e.getStatus() === 403);
  const exports = new ExportContadorService({}, permisos);
  for (const format of ['Excel', 'Zip']) await assert.rejects(exports[`generar${format}`](contadorId, 'CONTADOR_EXTERNO', c.emp.id, {}), e => e.getStatus() === 403);
  const docs = new DocumentosEmpresaService(permisos, {}, {});
  await assert.rejects(docs.getDownloadUrlContador(contadorId, 'CONTADOR_EXTERNO', c.emp.id, randomUUID()), e => e.getStatus() === 403);
  const sesionContador = await sesiones.crear({ ...c.user, id: contadorId, tipoUsuario: 'CONTADOR_EXTERNO' });
  assert.equal((await sesiones.validar(jwt.decode(sesionContador.access_token))).id, contadorId);
  await sesiones.revocarToken(c.response.access_token);
});
test('Pago con periodo/monto cero recupera acceso después de prueba; manual no evade vencimiento ni suspensión', async t => {
  const c = await registro(t);
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() - 1000) }).where(eq(empresa.id, c.emp.id));
  const admin = new SuperadminService({}, permisos, suscripciones, {});
  await assert.rejects(admin.updateEstadoEmpresa(c.emp.id, 'ACTIVO'), /periodo vigente/);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  await suscripciones.registrarPago(c.user.id, c.emp.id, 0, hoy, 1);
  await permisos.checkEmpresaActiva(c.emp.id);
  assert.equal((await permisos.getAccesoEmpresa(c.emp.id)).prueba, false);
  await admin.updateEstadoEmpresa(c.emp.id, 'SUSPENDIDO');
  await suscripciones.registrarPago(c.user.id, c.emp.id, 10, hoy, 3);
  await assert.rejects(permisos.checkEmpresaActiva(c.emp.id), /suspendida/);
  await admin.updateEstadoEmpresa(c.emp.id, 'ACTIVO');
  await permisos.checkEmpresaActiva(c.emp.id);
});
test('Nuevas URLs se acotan al tiempo restante y no se emiten al vencer', async t => {
  const c = await registro(t);
  assert.equal(await permisos.getSegundosDescarga(c.emp.id), 60);
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() + 10000) }).where(eq(empresa.id, c.emp.id));
  const remaining = await permisos.getSegundosDescarga(c.emp.id);
  assert.ok(remaining >= 1 && remaining <= 10);
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() - 1) }).where(eq(empresa.id, c.emp.id));
  await assert.rejects(permisos.getSegundosDescarga(c.emp.id), e => e.getStatus() === 403);
});
test('RUC repetido no concede ni reinicia prueba; un pago antiguo no recupera acceso', async t => {
  const c = await registro(t);
  auth.verificarCredencialGoogle = async () => ({ email: `${randomUUID()}@example.test`, nombre: 'Otra cuenta' });
  await assert.rejects(auth.googleRegistro({ tipo: 'EMPRESA', credential: 'fixture', nombre_completo: 'Otra Cuenta',
    acepta_terminos: true, privacidad_leida: true, declara_representacion: true, version_legal: require('../../dist/auth/aceptacion-legal').VERSION_LEGAL,
    ruc: c.ruc, razon_social: 'Repetida' }), /RUC ya/);
  const [actual] = await db.select().from(empresa).where(eq(empresa.id, c.emp.id));
  assert.equal(actual.pruebaHasta.getTime(), c.emp.pruebaHasta.getTime());
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() - 1000) }).where(eq(empresa.id, c.emp.id));
  await suscripciones.registrarPago(c.user.id, c.emp.id, 10, '2020-01-01', 1);
  await assert.rejects(permisos.checkEmpresaActiva(c.emp.id), e => e.getStatus() === 403);
});
test('Pago durante prueba amplía acceso; cambios de BD bloquean también escrituras por usuario interno', async t => {
  const c = await registro(t);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  await suscripciones.registrarPago(c.user.id, c.emp.id, 10, hoy, 1);
  const acceso = await permisos.getAccesoEmpresa(c.emp.id);
  assert.equal(acceso.prueba, false); assert.ok(acceso.hasta > c.emp.pruebaHasta);
  await db.update(empresa).set({ pruebaHasta: new Date(Date.now() - 1000) }).where(eq(empresa.id, c.emp.id));
  await sesiones.validar(jwt.decode(c.response.access_token));
  await db.update(empresa).set({ estadoSuscripcion: 'SUSPENDIDO', suspendidaPorPago: false }).where(eq(empresa.id, c.emp.id));
  await assert.rejects(permisos.checkPermiso(c.user.id, 'USUARIO_MANAGE'), e => e.getStatus() === 403);
});
