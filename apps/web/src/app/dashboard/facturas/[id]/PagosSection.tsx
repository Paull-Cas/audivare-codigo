'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PagoComprobante from './PagoComprobante';
import FileInputES from '@/components/FileInputES';
import AyudaTip from '@/components/AyudaTip';
import { simboloMoneda } from '@/lib/moneda';

interface Pago {
  id: string;
  montoPagado: string;
  tipoPago?: string;
  nota: string | null;
  fechaRegistro: string;
  comprobanteNombre: string | null;
}

export default function PagosSection({
  facturaId,
  estadoFactura,
  moneda,
  montoTotal,
  saldoPendiente,
  pagos,
  puedeRegistrarPago,
  puedeActualizarPago,
  puedeEliminarPago,
  apiBase,
  proxyBase,
}: {
  facturaId: string;
  estadoFactura: string;
  moneda: string;
  montoTotal: number;
  saldoPendiente: number;
  pagos: Pago[];
  puedeRegistrarPago: boolean;
  puedeActualizarPago: boolean;
  puedeEliminarPago: boolean;
  // Bases para reutilizar la sección desde el contador. Empresa: defaults.
  apiBase?: string;   // multipart: `/api/facturas/:id` (default)
  proxyBase?: string; // /api/proxy: `/facturas/:id` (default)
}) {
  const base = apiBase ?? `/api/facturas/${facturaId}`;
  const simbolo = simboloMoneda(moneda);
  const [deletingPago, setDeletingPago] = useState<Pago | null>(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPago, setEditingPago] = useState<Pago | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; esImagen: boolean; esPdf: boolean } | null>(null);
  const router = useRouter();

  const totalPagado = montoTotal - saldoPendiente;
  const maxMonto = editingPago ? saldoPendiente + parseFloat(editingPago.montoPagado) : saldoPendiente;

  // Libera el object URL de la previsualización al cambiarla o desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const clearPreview = () => {
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    clearPreview();
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setPreview({
      url: URL.createObjectURL(file),
      name: file.name,
      esImagen: ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext),
      esPdf: ext === 'pdf',
    });
  };

  const handleOpenCreateModal = () => {
    setEditingPago(null);
    clearPreview();
    setShowModal(true);
  };

  const handleOpenEditModal = (pago: Pago) => {
    setEditingPago(pago);
    clearPreview();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPago(null);
    clearPreview();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const monto = parseFloat(formData.get('monto_pagado') as string);

    if (!editingPago && !(formData.get('file') as File)?.size) {
      alert('El comprobante de pago es obligatorio');
      setLoading(false);
      return;
    }
    if (monto > maxMonto) {
      alert('El monto excede el saldo pendiente');
      setLoading(false);
      return;
    }

    try {
      const url = editingPago
        ? `${base}/pagos/${editingPago.id}`
        : `${base}/pagos`;
      const method = editingPago ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
      });

      if (res.ok) {
        handleCloseModal();
        router.refresh();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Error al ${editingPago ? 'actualizar' : 'registrar'} pago: ` + (errorData.message || res.status));
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al guardar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPago) return;
    setLoadingDelete(true);
    try {
      const res = await fetch(`${base}/pagos/${deletingPago.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingPago(null);
        router.refresh();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert('Error al eliminar el pago: ' + (errorData.message || res.status));
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al eliminar el pago');
    } finally {
      setLoadingDelete(false);
    }
  };

  if (estadoFactura !== 'ACTIVA' && estadoFactura !== 'PAGADA') {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-[var(--color-border)] shadow-sm mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 mb-4 gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Registro de Pagos</h2>
          <AyudaTip titulo="Registro de pagos" texto="Registra cada pago con su monto y comprobante (obligatorio). El saldo se descuenta solo y la factura pasa a PAGADA cuando llega a 0. Marca 'Pago por detracción' si ese pago corresponde a la detracción (depósito al Banco de la Nación)." />
        </div>
        {puedeRegistrarPago && estadoFactura === 'ACTIVA' && (
          <button
            onClick={handleOpenCreateModal}
            className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            Registrar pago
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Monto Total</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{simbolo} {montoTotal.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Total Pagado</div>
          <div className="text-xl font-bold text-green-600 mt-1">{simbolo} {totalPagado.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Saldo Pendiente</div>
          <div className={`text-xl font-bold mt-1 ${saldoPendiente === 0 ? 'text-green-600' : 'text-blue-600'}`}>
            {simbolo} {saldoPendiente.toFixed(2)}
          </div>
        </div>
      </div>

      {pagos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          No hay pagos registrados
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-y">
              <tr>
                <th className="px-4 py-3 font-semibold">Registrado</th>
                <th className="px-4 py-3 font-semibold">Monto</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Nota</th>
                <th className="px-4 py-3 font-semibold text-right">Comprobante</th>
                {(puedeActualizarPago || puedeEliminarPago) && <th className="px-4 py-3 font-semibold text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(pago => (
                <tr key={pago.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">{pago.fechaRegistro ? new Date(pago.fechaRegistro).toLocaleDateString('es-PE') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{simbolo} {parseFloat(pago.montoPagado).toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {pago.tipoPago === 'DETRACCION' ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">Detracción</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[240px] truncate" title={pago.nota || ''}>{pago.nota || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {pago.comprobanteNombre ? (
                      <div className="flex justify-end">
                        <PagoComprobante
                          facturaId={facturaId}
                          pagoId={pago.id}
                          nombreArchivo={pago.comprobanteNombre}
                          proxyBase={proxyBase}
                        />
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">-</span>
                    )}
                  </td>
                  {(puedeActualizarPago || puedeEliminarPago) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {puedeActualizarPago && (
                          <button
                            onClick={() => handleOpenEditModal(pago)}
                            title="Editar pago"
                            aria-label="Editar pago"
                            className="inline-flex items-center justify-center p-1.5 rounded text-[var(--color-primary)] bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {puedeEliminarPago && (
                          <button
                            onClick={() => setDeletingPago(pago)}
                            title="Eliminar pago"
                            aria-label="Eliminar pago"
                            className="inline-flex items-center justify-center p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">{editingPago ? 'Editar pago' : 'Registrar nuevo pago'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Monto a pagar (Máx. {simbolo} {maxMonto.toFixed(2)})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">{simbolo}</span>
                  </div>
                  <input
                    type="number"
                    name="monto_pagado"
                    step="0.01"
                    min="0.01"
                    max={maxMonto}
                    required
                    defaultValue={editingPago ? editingPago.montoPagado : undefined}
                    className={`w-full border border-gray-300 rounded-md ${simbolo.length > 2 ? 'pl-12' : 'pl-8'} pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2.5 border border-gray-300 rounded-md px-3 py-2.5 text-sm cursor-pointer has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 transition-colors">
                  <input type="checkbox" name="tipo_pago" value="DETRACCION" defaultChecked={editingPago?.tipoPago === 'DETRACCION'} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-200" />
                  <span className="font-medium text-gray-700">Pago por detracción</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Márcalo si este pago corresponde a la detracción (depósito al Banco de la Nación).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota (opcional)</label>
                <textarea
                  name="nota"
                  defaultValue={editingPago?.nota ?? ''}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] min-h-[70px]"
                  placeholder="Ej. Transferencia bancaria, operación 000123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Comprobante de pago {editingPago && '(Dejar vacío para conservar el actual)'}
                </label>
                {editingPago?.comprobanteNombre && (
                  <p className="text-xs text-gray-500 mb-1.5">
                    Comprobante actual: <span className="font-medium text-gray-700">{editingPago.comprobanteNombre}</span>
                  </p>
                )}
                <FileInputES
                  name="file"
                  requerido={!editingPago}
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-1.5">Formatos permitidos: PDF, PNG, JPG</p>

                {preview && (
                  <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                      <span className="text-xs font-medium text-gray-600 truncate pr-2">Vista previa: {preview.name}</span>
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-primary)] font-medium hover:underline shrink-0"
                      >
                        Abrir
                      </a>
                    </div>
                    {preview.esImagen ? (
                      <img src={preview.url} alt={preview.name} className="max-h-56 w-full object-contain bg-gray-100" />
                    ) : preview.esPdf ? (
                      <iframe src={preview.url} title={preview.name} className="w-full h-56 bg-gray-100" />
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-500">No se puede previsualizar este tipo de archivo.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editingPago ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPago && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loadingDelete && setDeletingPago(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar este pago?</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Se eliminará el pago de <span className="font-semibold text-gray-700">{simbolo} {parseFloat(deletingPago.montoPagado).toFixed(2)}</span>. El saldo pendiente aumentará y, si la factura estaba pagada, volverá a estado ACTIVA. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeletingPago(null)}
                disabled={loadingDelete}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loadingDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loadingDelete ? 'Eliminando...' : 'Eliminar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
