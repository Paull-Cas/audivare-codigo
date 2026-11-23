const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularAccesoEmpresa, finAccesoPago, HORAS_PRUEBA } = require('../dist/common/acceso-empresa.util');
const fin = new Date('2026-10-15T18:34:56.789Z');
const empresa = { estadoSuscripcion: 'ACTIVO', pruebaHasta: fin };
test('Prueba: 168 horas y frontera exacta, sin gracia adicional', () => {
  assert.equal(HORAS_PRUEBA, 168);
  assert.equal(calcularAccesoEmpresa(empresa, undefined, new Date(fin.getTime() - 1)).permitido, true);
  assert.equal(calcularAccesoEmpresa(empresa, undefined, fin).permitido, false);
  assert.equal(calcularAccesoEmpresa(empresa, undefined, new Date(fin.getTime() + 1)).permitido, false);
});
test('Pago durante/después de prueba conserva periodo y gracia, con fecha de Perú', () => {
  const pago = { fechaPago: '2026-10-10', duracionMeses: 1 };
  const hasta = new Date('2026-11-17T05:00:00Z');
  assert.equal(finAccesoPago(pago).toISOString(), hasta.toISOString());
  assert.equal(calcularAccesoEmpresa(empresa, pago, new Date('2026-10-16T00:00:00Z')).permitido, true);
  assert.equal(calcularAccesoEmpresa(empresa, pago, hasta).permitido, false);
});
test('Un pago antiguo no amplía ni anula una prueba aún vigente', () => {
  const result = calcularAccesoEmpresa(empresa, { fechaPago: '2025-01-01', duracionMeses: 1 }, new Date(fin.getTime() - 1));
  assert.equal(result.permitido, true); assert.equal(result.hasta.getTime(), fin.getTime());
});
test('Fin de mes y año bisiesto no desbordan el periodo', () => {
  assert.equal(finAccesoPago({ fechaPago: '2024-01-31', duracionMeses: 1 }).toISOString(), '2024-03-07T05:00:00.000Z');
  assert.equal(finAccesoPago({ fechaPago: '2026-01-31', duracionMeses: 1 }).toISOString(), '2026-03-07T05:00:00.000Z');
});
test('Suspensión manual y pendientes prevalecen sobre prueba y pago', () => {
  for (const estadoSuscripcion of ['SUSPENDIDO', 'PENDIENTE']) assert.equal(calcularAccesoEmpresa(
    { ...empresa, estadoSuscripcion }, { fechaPago: '2026-10-10', duracionMeses: 12 }, new Date('2026-10-11')).permitido, false);
});
test('Empresas previas sin prueba conservan tratamiento, no reciben prueba nueva', () => {
  assert.equal(calcularAccesoEmpresa({ estadoSuscripcion: 'ACTIVO', pruebaHasta: null }).permitido, true);
  assert.equal(calcularAccesoEmpresa({ estadoSuscripcion: 'PENDIENTE', pruebaHasta: null }).permitido, false);
});
