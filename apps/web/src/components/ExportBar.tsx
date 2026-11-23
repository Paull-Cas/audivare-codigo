'use client';

import { useState } from 'react';

interface ExportBarProps {
  // Modo contador: exporta una empresa vinculada (requiere empresaId).
  // Modo empresa: exporta la propia empresa (empresaId se resuelve en el backend).
  mode?: 'contador' | 'empresa';
  empresaId?: string;
  searchParams: { [key: string]: string | undefined };
  // Qué botones mostrar (en modo empresa, según los permisos del usuario).
  canExcel?: boolean;
  canZip?: boolean;
}

export default function ExportBar({
  mode = 'contador',
  empresaId,
  searchParams,
  canExcel = true,
  canZip = true,
}: ExportBarProps) {
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Año obligatorio para exportar (por defecto, el del filtro o el año actual).
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 7 }, (_, i) => String(anioActual - i));
  const [anio, setAnio] = useState(searchParams.anio || String(anioActual));
  const [mes, setMes] = useState(searchParams.mes || '');

  const MESES = [
    { v: '1', n: 'Enero' }, { v: '2', n: 'Febrero' }, { v: '3', n: 'Marzo' },
    { v: '4', n: 'Abril' }, { v: '5', n: 'Mayo' }, { v: '6', n: 'Junio' },
    { v: '7', n: 'Julio' }, { v: '8', n: 'Agosto' }, { v: '9', n: 'Septiembre' },
    { v: '10', n: 'Octubre' }, { v: '11', n: 'Noviembre' }, { v: '12', n: 'Diciembre' },
  ];

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (searchParams.estado && searchParams.estado !== 'TODOS')
      params.set('estado', searchParams.estado);
    if (searchParams.proveedor) params.set('proveedor', searchParams.proveedor);
    params.set('anio', anio);
    if (mes) params.set('mes', mes);
    return params.toString();
  };

  const triggerDownload = async (tipo: 'excel' | 'zip') => {
    if (!anio) {
      setError('Debes seleccionar el año a exportar');
      return;
    }
    const setter = tipo === 'excel' ? setLoadingExcel : setLoadingZip;
    setter(true);
    setError(null);

    try {
      const qs = buildQueryString();
      const url =
        mode === 'empresa'
          ? `/api/facturas-export/${tipo}${qs ? '?' + qs : ''}`
          : `/api/export/${tipo}?empresaId=${empresaId}${qs ? '&' + qs : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message || 'Error al generar la exportación');
        return;
      }

      const blob = await res.blob();
      const ext = tipo === 'excel' ? 'xlsx' : 'zip';
      const filename = `facturas_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Error de conexión al generar la exportación');
    } finally {
      setter(false);
    }
  };

  // Si el usuario no puede exportar en ningún formato, no se muestra la barra.
  if (!canExcel && !canZip) return null;

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Año <span className="text-red-500">*</span></label>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mes (opcional)</label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]">
              <option value="">Todo el año</option>
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>El ZIP se organiza por mes y factura; el Excel marca qué documentación tiene cada una.</span>
          {error && <span className="text-red-500 font-medium">— {error}</span>}
        </div>
      </div>

      <div className="flex gap-3 flex-shrink-0">
        {canExcel && (
          <button
            id="btn-export-excel"
            onClick={() => triggerDownload('excel')}
            disabled={loadingExcel}
            className="flex items-center gap-2 btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {loadingExcel ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {loadingExcel ? 'Generando...' : 'Exportar Excel'}
          </button>
        )}

        {canZip && (
          <button
            id="btn-export-zip"
            onClick={() => triggerDownload('zip')}
            disabled={loadingZip}
            className="flex items-center gap-2 btn-accent text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {loadingZip ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {loadingZip ? 'Generando...' : 'Exportar ZIP'}
          </button>
        )}
      </div>
    </div>
  );
}
