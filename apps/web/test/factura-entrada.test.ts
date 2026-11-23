import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entradaFactura, patronFactura } from '../src/components/factura-entrada';

test('Número y RUC rechazan letras, signos y notación científica al escribir o pegar', () => {
  for (const campo of ['numero', 'proveedorRuc']) {
    for (const valor of ['123a', '1e3', '-12', '12.3', '12 3', '12\n3']) assert.equal(entradaFactura(campo, valor), null);
    assert.equal(entradaFactura(campo, '00123'), '00123');
    assert.equal(entradaFactura(campo, ''), '');
  }
  assert.equal(entradaFactura('proveedorRuc', '123456789012'), null);
});

test('Importes rechazan entradas inválidas completas sin cambiar su significado', () => {
  for (const campo of ['montoTotal', 'baseImponible', 'igv']) {
    for (const valor of ['10abc20', '1e3', '-10', '10.123', '1,000.00', '1.000,00', '1..2']) assert.equal(entradaFactura(campo, valor), null);
    assert.equal(entradaFactura(campo, '12,50'), '12.50');
    assert.equal(entradaFactura(campo, '12.'), '12.');
    assert.equal(entradaFactura(campo, ''), '');
    const patron = new RegExp(`^(?:${patronFactura(campo)})$`);
    assert.equal(patron.test('12.'), false);
    assert.equal(patron.test('12.50'), true);
  }
});

test('Serie alfanumérica en mayúsculas y nombre del proveedor conservado', () => {
  assert.equal(entradaFactura('serie', 'f001'), 'F001');
  assert.equal(entradaFactura('serie', 'F-001'), null);
  assert.equal(entradaFactura('proveedorNombre', 'José & Hijos S.A.C.'), 'José & Hijos S.A.C.');
});
