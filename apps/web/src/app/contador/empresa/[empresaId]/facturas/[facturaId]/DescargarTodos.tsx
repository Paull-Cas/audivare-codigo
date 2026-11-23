'use client';

import { useState } from 'react';

interface DescargarTodosProps {
  empresaId: string;
  facturaId: string;
  numDocumentos: number;
}

export default function DescargarTodos({ empresaId, facturaId, numDocumentos }: DescargarTodosProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (numDocumentos === 0) return null;

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the ZIP endpoint filtered by facturaId — but since the backend doesn't support
      // per-factura filter we proxy via the empresa zip endpoint and filter client-side.
      // Alternatively we call the batch zip endpoint with the facturaId search.
      const url = `/api/export/zip?empresaId=${empresaId}&facturaId=${facturaId}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message || 'Error al generar el ZIP');
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `documentos_factura_${facturaId.substring(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-red-500 text-xs">{error}</span>}
      <button
        id="btn-descargar-todos"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-1.5 btn-accent text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        )}
        {loading ? 'Generando...' : `Descargar todos (${numDocumentos})`}
      </button>
    </div>
  );
}
