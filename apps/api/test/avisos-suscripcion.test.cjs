const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planAvisoNuevo, fechaPeru } = require('../dist/superadmin/aviso-suscripcion.util');
const emp = { estadoSuscripcion: 'ACTIVO', pruebaHasta: new Date('2026-10-15T18:34:56Z') };
test('Aviso de prueba en instante exacto, sin gracia ni aviso adelantado', () => {
  assert.equal(planAvisoNuevo(emp, undefined, new Date('2026-10-15T18:34:55.999Z')), undefined);
  const aviso = planAvisoNuevo(emp, undefined, emp.pruebaHasta);
  assert.equal(aviso.etapa, 'BLOQUEADO'); assert.equal(aviso.origen, 'PRUEBA'); assert.equal(aviso.hasta, emp.pruebaHasta);
});
test('Periodo pagado avisa al vencer y al agotarse gracia según Perú', () => {
  const pago = { id: 'p1', fechaPago: '2026-10-10', duracionMeses: 1 };
  assert.equal(planAvisoNuevo(emp, pago, new Date('2026-11-10T04:59:59.999Z')), undefined);
  assert.equal(planAvisoNuevo(emp, pago, new Date('2026-11-10T05:00:00Z')).etapa, 'VENCIDO');
  assert.equal(planAvisoNuevo(emp, pago, new Date('2026-11-17T04:59:59.999Z')).etapa, 'VENCIDO');
  assert.equal(planAvisoNuevo(emp, pago, new Date('2026-11-17T05:00:00Z')).etapa, 'BLOQUEADO');
});
test('Suspensión manual, pendiente y modelo anterior no reciben plan nuevo', () => {
  for (const estadoSuscripcion of ['SUSPENDIDO', 'PENDIENTE']) assert.equal(planAvisoNuevo({ ...emp, estadoSuscripcion }, undefined, emp.pruebaHasta), undefined);
  assert.equal(planAvisoNuevo({ estadoSuscripcion: 'ACTIVO', pruebaHasta: null }, undefined, emp.pruebaHasta), undefined);
});
test('Pago antiguo no acorta prueba ni le añade gracia', () => {
  const aviso = planAvisoNuevo(emp, { id: 'antiguo', fechaPago: '2025-01-01', duracionMeses: 1 }, emp.pruebaHasta);
  assert.equal(aviso.origen, 'PRUEBA'); assert.equal(aviso.hasta.getTime(), emp.pruebaHasta.getTime());
});
test('Prueba superpuesta a vencimiento pagado evita aviso engañoso mientras hay prueba', () => {
  const pruebaHasta = new Date('2026-11-12T12:00:00Z'), pago = { id: 'p2', fechaPago: '2026-10-10', duracionMeses: 1 };
  assert.equal(planAvisoNuevo({ ...emp, pruebaHasta }, pago, new Date('2026-11-11T12:00:00Z')), undefined);
  assert.equal(planAvisoNuevo({ ...emp, pruebaHasta }, pago, pruebaHasta).etapa, 'VENCIDO');
});
test('Fin de mes conserva frontera bisiesta y fecha legible de Perú', () => {
  const e = { ...emp, pruebaHasta: new Date('2024-02-01T00:00:00Z') };
  assert.equal(planAvisoNuevo(e, { id: 'bisiesto', fechaPago: '2024-01-31', duracionMeses: 1 }, new Date('2024-03-07T05:00:00Z')).etapa, 'BLOQUEADO');
  assert.equal(fechaPeru(new Date('2026-11-10T04:59:59Z')), '9/11/2026');
});
