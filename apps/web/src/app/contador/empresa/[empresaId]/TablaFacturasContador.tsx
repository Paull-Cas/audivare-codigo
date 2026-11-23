'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BadgeEstadoFactura from '@/components/BadgeEstadoFactura';
import BadgeDocumentacion from '@/components/BadgeDocumentacion';
import { formatoMonto } from '@/lib/moneda';
import { fechaCorta } from '@/lib/fecha';

interface Factura {
  id: string;
  serie: string;
  numero: string;
  proveedor_razon_social: string;
  proveedor_ruc: string;
  moneda: string;
  monto_total: string | number;
  saldo_pendiente: string | number;
  fecha_emision: string;
  estado: string;
  documentacion_estado: string;
}

interface FacturaConservada {
  id: string;
  serie: string | null;
  numero: string | null;
  documentos: number;
  pagos: number;
  motivo: string;
}

interface ResultadoEliminacion {
  eliminadas: number;
  conservadas: FacturaConservada[];
}

export default function TablaFacturasContador({ empresaId, facturas }: { empresaId: string; facturas: Factura[] }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; single: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEliminacion | null>(null);
  const [bloqueada, setBloqueada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todasVisibles = facturas.length > 0 && facturas.every((f) => seleccion.has(f.id));
  const toggleTodas = () => {
    setSeleccion((prev) => {
      if (todasVisibles) return new Set();
      const next = new Set(prev);
      facturas.forEach((f) => next.add(f.id));
      return next;
    });
  };

  const ejecutar = async () => {
    if (!confirm) return;
    setLoading(true);
    setError(null);
    try {
      const path = confirm.single
        ? `/contador/empresas/${empresaId}/facturas/${confirm.ids[0]}`
        : `/contador/empresas/${empresaId}/facturas`;
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          method: 'DELETE',
          body: confirm.single ? undefined : { ids: confirm.ids },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirm(null);
        setSeleccion(new Set());
        setResultado(data as ResultadoEliminacion);
        router.refresh();
      } else if (res.status === 409) {
        // Factura con documentos/pagos: no se puede eliminar.
        setConfirm(null);
        setBloqueada(data.message || 'La factura no se puede eliminar porque tiene documentación o pagos registrados.');
      } else {
        setError(data.message || 'No se pudieron eliminar las facturas');
      }
    } catch {
      setError('Error de red al eliminar');
    } finally {
      setLoading(false);
    }
  };

  const cerrarResultado = () => {
    setResultado(null);
    router.refresh();
  };

  const seleccionadas = seleccion.size;

  return (
    <>
      {seleccionadas > 0 && (
        <div className="flex items-center justify-between gap-4 px-6 py-3 bg-blue-50 border-b border-[var(--color-border)]">
          <span className="text-sm font-medium text-gray-700">{seleccionadas} factura(s) seleccionada(s)</span>
          <div className="flex gap-2">
            <button onClick={() => setSeleccion(new Set())} className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">Deseleccionar</button>
            <button onClick={() => setConfirm({ ids: Array.from(seleccion), single: false })} className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-700 transition-colors">Eliminar seleccionadas</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-gray-50/50 border-b border-[var(--color-border)]">
              <th className="px-4 py-4 w-10">
                <input type="checkbox" checked={todasVisibles} onChange={toggleTodas} className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-blue-200" aria-label="Seleccionar todas" />
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serie-Número</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Monto total</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Saldo pendiente</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documentación</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha emisión</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {facturas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500 font-medium">No se encontraron facturas</td>
              </tr>
            ) : (
              facturas.map((f) => (
                <tr key={f.id} className={`transition-colors ${seleccion.has(f.id) ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={seleccion.has(f.id)} onChange={() => toggle(f.id)} className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-blue-200" aria-label={`Seleccionar ${f.serie}-${f.numero}`} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text)]">{f.serie}-{f.numero}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text)]">
                    <div className="font-medium">{f.proveedor_razon_social}</div>
                    <div className="text-xs text-gray-500 mt-0.5">RUC: {f.proveedor_ruc}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text)] text-right font-medium">{formatoMonto(f.monto_total, f.moneda)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text)] text-right font-medium">{formatoMonto(f.saldo_pendiente, f.moneda)}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><BadgeEstadoFactura estado={f.estado} /></td>
                  <td className="px-6 py-4 whitespace-nowrap"><BadgeDocumentacion estado={f.documentacion_estado} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{fechaCorta(f.fecha_emision)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/contador/empresa/${empresaId}/facturas/${f.id}`} className="text-[var(--color-primary)] hover:text-blue-700" title="Ver detalle" aria-label={`Ver detalle ${f.serie}-${f.numero}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </Link>
                      <button onClick={() => setConfirm({ ids: [f.id], single: true })} className="text-red-600 hover:text-red-700" title="Eliminar factura" aria-label={`Eliminar ${f.serie}-${f.numero}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmación de borrado */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Eliminar factura(s)</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
              <p className="text-sm text-gray-600">
                {confirm.single
                  ? '¿Seguro que deseas eliminar esta factura? Esta acción no se puede deshacer.'
                  : `¿Seguro que deseas eliminar ${confirm.ids.length} factura(s)? Esta acción no se puede deshacer.`}
              </p>
              <p className="text-xs text-gray-500">
                Las facturas que tengan documentación o pagos cargados por la empresa <span className="font-semibold">no se eliminarán</span>; se te informará cuáles se conservaron.
              </p>
              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setConfirm(null)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={ejecutar} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado del borrado (masivo o individual con éxito) */}
      {resultado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={cerrarResultado}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Resultado</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                {resultado.eliminadas} factura(s) eliminada(s).
              </div>
              {resultado.conservadas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800">
                    {resultado.conservadas.length} factura(s) no se eliminaron porque tienen trabajo de la empresa:
                  </p>
                  <div className="max-h-48 overflow-y-auto bg-amber-50 border border-amber-100 rounded-md p-2 text-xs text-amber-800 space-y-1.5">
                    {resultado.conservadas.map((c) => (
                      <div key={c.id}>
                        <span className="font-semibold">{c.serie}-{c.numero}</span>: {c.motivo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 flex justify-end">
                <button onClick={cerrarResultado} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta: factura individual no eliminable (409) */}
      {bloqueada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBloqueada(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h2 className="text-lg font-semibold text-gray-900">No se puede eliminar</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{bloqueada}</p>
              <p className="text-xs text-gray-500">
                Para proteger el trabajo de la empresa, una factura con documentación o pagos no puede eliminarse. Si de verdad es un error, coordina con la empresa para retirar antes esos documentos/pagos.
              </p>
              <div className="pt-2 flex justify-end">
                <button onClick={() => setBloqueada(null)} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium">Entendido</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
