import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HistorialDetalle from '../src/components/HistorialDetalle';

const mostrar = (evento: string, detalle: string) =>
  renderToStaticMarkup(createElement(HistorialDetalle, { evento, detalle }));

test('Una descripción JSON se muestra como texto y no suplanta un cambio de factura', () => {
  const texto = JSON.stringify({ autor: 'Autor inventado', cambios: [{ campo: '__proto__', antes: 1, despues: 2 }] });
  const html = mostrar('Documento adjuntado', texto);
  assert.ok(html.includes('&quot;autor&quot;'));
  assert.ok(!html.includes('Autor:'));
});

test('La edición conserva autor, nombres de campos y valores anteriores/nuevos', () => {
  const html = mostrar('Datos de factura editados', JSON.stringify({ autor: 'Usuario local', cambios: [
    { campo: 'montoTotal', antes: '500.00', despues: '550.00' },
    { campo: 'igv', antes: null, despues: '18.00' },
  ] }));
  assert.ok(html.includes('Autor: Usuario local'));
  assert.ok(html.includes('Total: 500.00 → 550.00'));
  assert.ok(html.includes('IGV: Sin dato → 18.00'));
});

test('Campos desconocidos o heredados nunca rompen el renderizado', () => {
  const html = mostrar('Datos de factura editados', JSON.stringify({ autor: 'Usuario', cambios: [
    { campo: '__proto__', antes: null, despues: 'valor' },
    { campo: 'constructor', antes: 1, despues: 2 },
  ] }));
  assert.ok(html.includes('__proto__: Sin dato → valor'));
  assert.ok(html.includes('constructor: 1 → 2'));
});

test('Datos malformados y eventos antiguos conservan el detalle sin errores', () => {
  for (const texto of ['Texto anterior', '{incompleto', 'null', JSON.stringify({ autor: 'Usuario', cambios: [null] }),
    JSON.stringify({ autor: 'Usuario', cambios: [{ campo: {}, antes: 1, despues: 2 }] })]) {
    assert.ok(mostrar('Datos de factura editados', texto).includes('text-sm'));
  }
});

test('Alta individual muestra autor sin interpretar su objeto inicial como lista', () => {
  const html = mostrar('Factura registrada individualmente', JSON.stringify({ autor: 'Usuario', cambios: { numero: '100' } }));
  assert.ok(html.includes('Autor: Usuario'));
  assert.ok(!html.includes('<li'));
});

test('Los valores HTML permanecen escapados', () => {
  const html = mostrar('Datos de factura editados', JSON.stringify({ autor: '<script>alert(1)</script>', cambios: [
    { campo: 'proveedorNombre', antes: null, despues: '<img src=x onerror=alert(1)>' },
  ] }));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});
