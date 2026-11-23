'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileInputES from '@/components/FileInputES';
import AyudaTip from '@/components/AyudaTip';
import Link from 'next/link';

interface Resultado {
  total_filas: number;
  creadas: number;
  omitidas: number;
  errores: number;
  detalle_errores: string[];
  revision?: { nuevas: number; coincidentes: number; diferencias: number; identidadInsuficiente: number;
    detalles: { linea: number; comprobante: string; estado: string; facturaId?: string; campos?: string[] }[] };
}

export default function ImportarFacturasButton({ empresaId }: { empresaId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [revision, setRevision] = useState<Resultado | null>(null);
  const router = useRouter();

  const abrir = () => {
    setArchivo(null);
    setError(null);
    setResultado(null);
    setRevision(null);
    setOpen(true);
  };

  const importar = async () => {
    if (!archivo) {
      setError('Selecciona el archivo del registro de compras (CSV)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', archivo);
      formData.append('revisar', revision ? 'false' : 'true');
      const res = await fetch(`/api/contador/${empresaId}/importar`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (!revision) setRevision(data as Resultado);
        else { setResultado(data as Resultado); router.refresh(); }
      } else {
        setError(data.message || 'Error al importar el archivo');
      }
    } catch {
      setError('Error de red al importar el archivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={abrir}
        className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Importar facturas
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-semibold text-gray-900">Importar registro de compras</h2>
                <AyudaTip titulo="Importar facturas" texto="Exporta el Registro de Compras de SUNAT en CSV y súbelo aquí. Las facturas se crean automáticamente; las que ya existían se omiten (no se duplican). Si subes el archivo equivocado, puedes deshacer la importación después." />
              </div>
              <button onClick={() => !loading && setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {resultado ? (
                <div className="space-y-3">
                  <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                    Importación completada.
                  </div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>Filas leídas: <span className="font-semibold">{resultado.total_filas}</span></li>
                    <li>Facturas creadas: <span className="font-semibold text-green-700">{resultado.creadas}</span></li>
                    <li>Omitidas (existentes o por revisar): <span className="font-semibold">{resultado.omitidas}</span></li>
                    <li>Con error: <span className="font-semibold text-amber-700">{resultado.errores}</span></li>
                  </ul>
                  {resultado.detalle_errores.length > 0 && (
                    <div className="max-h-40 overflow-y-auto bg-amber-50 border border-amber-100 rounded-md p-2 text-xs text-amber-800 space-y-1">
                      {resultado.detalle_errores.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div className="pt-2 flex justify-end">
                    <button onClick={() => setOpen(false)} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium">Cerrar</button>
                  </div>
                </div>
              ) : (
                <>
                  {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
                  <p className="text-sm text-gray-500">Revisa el registro de compras antes de confirmar. Solo se añadirán comprobantes nuevos; los existentes conservarán sus datos, documentos y pagos.</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo CSV o Excel</label>
                    <FileInputES disabled={loading} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" requerido onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setRevision(null); }} />
                  </div>
                  {revision && <div className="text-sm space-y-2">
                    <p>Nuevas: {revision.revision?.nuevas} · Coincidentes: {revision.revision?.coincidentes}</p>
                    <p>Con diferencias: {revision.revision?.diferencias} · Identidad insuficiente: {revision.revision?.identidadInsuficiente} · Errores: {revision.errores}</p>
                    <p className="text-gray-500">Las diferencias se revisan en cada factura y no se sobrescriben. Corrige en el archivo los datos insuficientes. Se muestran hasta 50 filas; al confirmar se vuelve a comprobar todo.</p>
                    <ul className="max-h-48 overflow-auto space-y-2">{revision.revision?.detalles.map((d, i) => <li key={i}>
                      Fila {d.linea}: {d.comprobante} · {{ NUEVA: 'Nueva', COINCIDENTE: 'Ya existe', DIFERENCIAS: 'Revisar diferencias', IDENTIDAD_INSUFICIENTE: 'Falta identidad válida' }[d.estado] ?? d.estado}
                      {d.campos?.length ? ` (${d.campos.join(', ')})` : ''}
                      {d.facturaId && <Link className="block text-blue-700 underline" target="_blank" href={`/contador/empresa/${empresaId}/facturas/${d.facturaId}`}>Revisar factura existente</Link>}
                    </li>)}</ul>
                    {revision.detalle_errores.map((e, i) => <p key={i} className="text-amber-800">{e}</p>)}
                  </div>}
                  <div className="pt-2 flex gap-3 justify-end">
                    <button type="button" onClick={() => setOpen(false)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
                    <button type="button" onClick={importar} disabled={loading} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                      {loading ? 'Procesando…' : revision ? 'Confirmar importación de nuevas' : 'Revisar archivo'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
