'use client';

import { useState } from 'react';

interface PagoComprobanteProps {
  facturaId: string;
  pagoId: string;
  nombreArchivo: string;
  // Base del path de la API (vía /api/proxy). Empresa: `/facturas/:id` (default).
  proxyBase?: string;
}

export default function PagoComprobante({
  facturaId,
  pagoId,
  nombreArchivo,
  proxyBase,
}: PagoComprobanteProps) {
  const base = proxyBase ?? `/facturas/${facturaId}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const ext = nombreArchivo.split('.').pop()?.toLowerCase() || '';
  const esImagen = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const esPdf = ext === 'pdf';

  const abrir = async () => {
    setOpen(true);
    // Siempre se pide una URL firmada fresca: tras editar el pago, el comprobante
    // anterior se borró de MinIO y su ruta cambió, por lo que una URL cacheada
    // apuntaría a un archivo inexistente.
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${base}/pagos/${pagoId}/comprobante/descargar`,
          method: 'GET',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url);
      } else {
        setError('No se pudo cargar el comprobante');
      }
    } catch (e) {
      console.error(e);
      setError('Error de red al cargar el comprobante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={abrir}
        title="Ver comprobante"
        aria-label="Ver comprobante"
        className="inline-flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate pr-4">{nombreArchivo}</h2>
              <div className="flex items-center gap-2 shrink-0">
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={nombreArchivo}
                    className="inline-flex items-center gap-1.5 btn-primary text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Descargar
                  </a>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
              {loading && (
                <div className="flex flex-col items-center text-gray-500">
                  <svg className="animate-spin h-8 w-8 mb-2 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cargando...
                </div>
              )}
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {!loading && !error && url && (
                esImagen ? (
                  <img src={url} alt={nombreArchivo} className="max-w-full max-h-full object-contain" />
                ) : esPdf ? (
                  <iframe src={url} title={nombreArchivo} className="w-full h-full" />
                ) : (
                  <div className="text-center text-gray-500 p-8">
                    <p className="mb-4">No se puede previsualizar este tipo de archivo.</p>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] font-medium hover:underline">
                      Descargar archivo
                    </a>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
