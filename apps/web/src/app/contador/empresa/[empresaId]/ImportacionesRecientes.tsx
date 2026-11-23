'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export interface Importacion {
  id: string;
  nombre_archivo: string | null;
  creadas: number;
  facturas_vivas: number;
  fecha_creacion: string;
  revertible: boolean;
}

export default function ImportacionesRecientes({ empresaId, importaciones }: { empresaId: string; importaciones: Importacion[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirm, setConfirm] = useState<Importacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEliminacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (importaciones.length === 0) return null;

  const deshacer = async () => {
    if (!confirm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/contador/empresas/${empresaId}/importaciones/${confirm.id}`,
          method: 'DELETE',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirm(null);
        setResultado(data as ResultadoEliminacion);
        router.refresh();
      } else {
        setError(data.message || 'No se pudo deshacer la importación');
      }
    } catch {
      setError('Error de red al deshacer la importación');
    } finally {
      setLoading(false);
    }
  };

  const cerrarResultado = () => {
    setResultado(null);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <button onClick={() => setAbierto((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H6a2 2 0 00-2 2z" /></svg>
          <span className="text-sm font-semibold text-gray-700">Importaciones recientes</span>
          <span className="text-xs text-gray-400">({importaciones.length})</span>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {abierto && (
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          <p className="px-5 py-3 text-xs text-gray-500">
            ¿Subiste el archivo equivocado? Deshaz una importación para borrar de un golpe las facturas que creó. Las que ya tengan documentación o pagos de la empresa se conservan.
          </p>
          {importaciones.map((imp) => (
            <div key={imp.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{imp.nombre_archivo || 'Registro de compras SUNAT'}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(imp.fecha_creacion).toLocaleString()} · {imp.creadas} creada(s) · {imp.facturas_vivas} vigente(s)
                </div>
              </div>
              {imp.revertible ? (
                <button onClick={() => setConfirm(imp)} className="shrink-0 bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-100 transition-colors">Deshacer</button>
              ) : (
                <span className="shrink-0 text-xs text-gray-400">{imp.facturas_vivas === 0 ? 'Sin facturas' : 'Revertida'}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmación */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Deshacer importación</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
              <p className="text-sm text-gray-600">
                Se eliminarán las facturas creadas por <span className="font-semibold">{confirm.nombre_archivo || 'esta importación'}</span> ({confirm.facturas_vivas} vigente(s)). Esta acción no se puede deshacer.
              </p>
              <p className="text-xs text-gray-500">
                Las facturas con documentación o pagos de la empresa <span className="font-semibold">no se eliminarán</span>.
              </p>
              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setConfirm(null)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={deshacer} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                  {loading ? 'Deshaciendo...' : 'Deshacer importación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado */}
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
    </div>
  );
}
