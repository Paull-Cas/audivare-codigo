const { test } = require('node:test');
const assert = require('node:assert/strict');
const fastify = require('fastify');
const { registrarSeguridadHttp } = require('../dist/common/seguridad-http');

test('Referencias malformadas se rechazan antes del handler, también UUID anidados', async () => {
  const app = fastify(); let llamadas = 0;
  registrarSeguridadHttp(app, () => {});
  app.get('/documentos-mensuales/:id', async () => { llamadas++; return { ok: true }; });
  app.get('/contador/:empresaId/documentos-mensuales/:facturaId', async () => { llamadas++; return { ok: true }; });
  const id = '12345678-1234-1234-1234-123456789012';
  try {
    for (const url of ['/documentos-mensuales/no-es-uuid', '/documentos-mensuales/123', `/contador/${id}/documentos-mensuales/invalido`, `/contador/invalido/documentos-mensuales/${id}`]) {
      const r = await app.inject(url); assert.equal(r.statusCode, 400); assert.deepEqual(r.json(), { message: 'Referencia inválida' });
    }
    assert.equal(llamadas, 0);
    assert.equal((await app.inject(`/documentos-mensuales/${id}`)).statusCode, 200);
    assert.equal((await app.inject(`/contador/${id}/documentos-mensuales/${id}`)).statusCode, 200); assert.equal(llamadas, 2);
  } finally { await app.close(); }
});
test('Identificadores no UUID y campos de periodo conservan validación propia', async () => {
  const app = fastify(); registrarSeguridadHttp(app, () => {});
  app.get('/empresas/:identificador', async req => ({ ruc: req.params.identificador }));
  app.post('/documentos-mensuales', async req => req.body);
  try {
    const r = await app.inject('/empresas/20123456789'); assert.equal(r.statusCode, 200); assert.equal(r.json().ruc, '20123456789');
    const p = await app.inject({ method: 'POST', url: '/documentos-mensuales', payload: { anio: 2026, mes: 10 } });
    assert.equal(p.statusCode, 200); assert.equal(p.json().mes, 10);
  } finally { await app.close(); }
});

test('Flujos contables retirados responden 410 sin invocar controladores', async () => {
  const app = fastify(); registrarSeguridadHttp(app, () => {}); let llamadas = 0;
  app.post('/facturas', async () => { llamadas++; return {}; });
  app.post('/contador/empresas/:empresaId/importar', async () => { llamadas++; return {}; });
  try {
    assert.equal((await app.inject({method:'POST',url:'/facturas',payload:{}})).statusCode,410);
    assert.equal((await app.inject({method:'POST',url:'/contador/empresas/12345678-1234-1234-1234-123456789012/importar',payload:{}})).statusCode,410);
    assert.equal(llamadas,0);
  } finally { await app.close(); }
});
