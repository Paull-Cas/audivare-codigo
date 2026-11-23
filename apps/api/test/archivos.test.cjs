const { test } = require('node:test');
const assert = require('node:assert/strict');

// El cliente postgres se crea de forma diferida: TODAS las operaciones de BD
// usadas aquí se sustituyen antes de invocar el servicio. Nunca se usa storage real.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/audivare_test';
const { db, factura } = require('@audivare/database');
const { PermisosService } = require('../dist/common/permisos/permisos.service');
const { ExportContadorService } = require('../dist/contadores/export-contador.service');
const { FacturasService } = require('../dist/facturas/facturas.service');

const empresaId = '00000000-0000-4000-8000-000000000001';
const facturaId = '00000000-0000-4000-8000-000000000002';
const pagoId = '00000000-0000-4000-8000-000000000003';
const userId = '00000000-0000-4000-8000-000000000004';

function selectResult(rows) {
  return { from: () => ({ where: async () => rows }) };
}

for (const formato of ['Excel', 'Zip']) {
  for (const estado of ['ACTIVO', 'SUSPENDIDO', 'PENDIENTE']) {
    test(`${formato}: empresa ${estado}, con vínculo`, async (t) => {
      const consultas = [[{ contadorId: userId }], [{ estadoSuscripcion: estado }]];
      t.mock.method(db, 'select', () => selectResult(consultas.shift()));
      const service = new ExportContadorService({}, new PermisosService());
      const exportar = t.mock.method(service, `generar${formato}Empresa`, async () => 'exportado');
      const operacion = service[`generar${formato}`](userId, 'CONTADOR_EXTERNO', empresaId, {});
      if (estado === 'ACTIVO') {
        assert.equal(await operacion, 'exportado');
        assert.equal(exportar.mock.callCount(), 1);
      } else {
        await assert.rejects(operacion, /Empresa suspendida/);
        assert.equal(exportar.mock.callCount(), 0);
      }
      assert.equal(consultas.length, 0);
    });
  }

  test(`${formato}: rechaza contador sin vínculo antes de exportar`, async (t) => {
    t.mock.method(db, 'select', () => selectResult([]));
    const permisos = new PermisosService();
    const comprobarEstado = t.mock.method(permisos, 'checkEmpresaActiva');
    const service = new ExportContadorService({}, permisos);
    const exportar = t.mock.method(service, `generar${formato}Empresa`);
    await assert.rejects(service[`generar${formato}`](userId, 'CONTADOR_EXTERNO', empresaId, {}), /No estás vinculado/);
    assert.equal(comprobarEstado.mock.callCount(), 0);
    assert.equal(exportar.mock.callCount(), 0);
  });

  test(`${formato}: rechaza actor interno`, async (t) => {
    const consultar = t.mock.method(db, 'select');
    const service = new ExportContadorService({}, new PermisosService());
    await assert.rejects(service[`generar${formato}`](userId, 'INTERNO', empresaId, {}), /Solo contadores/);
    assert.equal(consultar.mock.callCount(), 0);
  });
}

function reemplazo(t, { falloSubida = false, falloBd = false, falloBorrado = false, sinArchivo = false } = {}) {
  const eventos = [];
  const archivos = new Set(['anterior.pdf']);
  const pago = { comprobantePath: 'anterior.pdf', comprobanteNombre: 'anterior.pdf', montoPagado: '10.00' };
  const storage = {
    async uploadFile() {
      eventos.push('subir');
      if (falloSubida) throw new Error('subida fallida');
      archivos.add('nuevo.pdf');
      return 'nuevo.pdf';
    },
    async deleteFile(path) {
      eventos.push(`borrar:${path}`);
      if (falloBorrado) throw new Error('borrado fallido');
      archivos.delete(path);
    },
  };
  t.mock.method(db, 'select', () => selectResult([{ ...pago }]));
  t.mock.method(db, 'transaction', async (fn) => {
    eventos.push('transaccion');
    let cambios;
    let primeraActualizacion = true;
    const tx = {
      select: () => ({ from: (table) => ({ where: () => table === factura
        ? { for: async () => [{ estadoFactura: 'ACTIVA', saldoPendiente: '90.00', moneda: 'PEN' }] }
        : Promise.resolve([{ ...pago }]) }) }),
      update: () => ({ set: (data) => ({ where: async () => {
        if (primeraActualizacion) cambios = data;
        primeraActualizacion = false;
      } }) }),
      insert: () => ({ values: async () => {} }),
    };
    const resultado = await fn(tx);
    if (falloBd) throw new Error('transacción fallida');
    Object.assign(pago, cambios);
    eventos.push('confirmar');
    return resultado;
  });
  const service = new FacturasService(storage, {}, {});
  t.mock.method(service, 'autorizarFactura', async () => ({
    empresaId,
    facturaData: { estadoFactura: 'ACTIVA', saldoPendiente: '90.00', moneda: 'PEN' },
  }));
  const avisos = t.mock.method(service.logger, 'warn', () => {});
  const ejecutar = () => service.actualizarPago({ kind: 'INTERNO', userId }, facturaId, pagoId, {
    montoPagado: 15,
    file: sinArchivo ? null : { filename: 'nuevo.pdf', mimetype: 'application/pdf', buffer: Buffer.from('simulado') },
  });
  return { eventos, archivos, pago, ejecutar, avisos };
}

test('Reemplazo: fallo de subida conserva archivo y referencia originales', async (t) => {
  const caso = reemplazo(t, { falloSubida: true });
  await assert.rejects(caso.ejecutar(), /subida fallida/);
  assert.deepEqual([...caso.archivos], ['anterior.pdf']);
  assert.equal(caso.pago.comprobantePath, 'anterior.pdf');
  assert.deepEqual(caso.eventos, ['subir']);
});

test('Reemplazo: fallo de BD conserva el original y no destruye el nuevo', async (t) => {
  const caso = reemplazo(t, { falloBd: true });
  await assert.rejects(caso.ejecutar(), /transacción fallida/);
  assert.equal(caso.pago.comprobantePath, 'anterior.pdf');
  assert.deepEqual([...caso.archivos], ['anterior.pdf', 'nuevo.pdf']);
  assert.deepEqual(caso.eventos, ['subir', 'transaccion']);
});

test('Reemplazo: retira el original solo después de confirmar la BD', async (t) => {
  const caso = reemplazo(t);
  const resultado = await caso.ejecutar();
  assert.deepEqual(caso.eventos, ['subir', 'transaccion', 'confirmar', 'borrar:anterior.pdf']);
  assert.deepEqual([...caso.archivos], ['nuevo.pdf']);
  assert.equal(caso.pago.comprobantePath, 'nuevo.pdf');
  assert.equal(resultado.saldo_pendiente_actualizado, 85);
});

test('Reemplazo: fallo al retirar el anterior no invalida el cambio confirmado', async (t) => {
  const caso = reemplazo(t, { falloBorrado: true });
  const resultado = await caso.ejecutar();
  assert.equal(caso.pago.comprobantePath, 'nuevo.pdf');
  assert.equal(resultado.comprobante_nombre, 'nuevo.pdf');
  assert.deepEqual([...caso.archivos], ['anterior.pdf', 'nuevo.pdf']);
  assert.equal(caso.avisos.mock.callCount(), 1);
});

test('Edición sin nuevo archivo conserva el comprobante', async (t) => {
  const caso = reemplazo(t, { sinArchivo: true });
  await caso.ejecutar();
  assert.deepEqual(caso.eventos, ['transaccion', 'confirmar']);
  assert.equal(caso.pago.comprobantePath, 'anterior.pdf');
});
