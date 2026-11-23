'use client';

import { useState } from 'react';
import FilePreviewModal from '@/components/FilePreviewModal';

interface PreviewDocumentoContadorProps {
  empresaId: string;
  facturaId: string;
  documentoId: string;
  nombreArchivo: string;
}

export default function PreviewDocumentoContador({
  empresaId,
  facturaId,
  documentoId,
  nombreArchivo,
}: PreviewDocumentoContadorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const abrir = async () => {
    setOpen(true);
    if (url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/contador/empresas/${empresaId}/facturas/${facturaId}/documentos/${documentoId}/download`,
          method: 'GET',
        }),
      });
      const data = await res.json().catch(() => ({})) as { url?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(data.message || 'No se pudo cargar el documento');
        return;
      }
      setUrl(data.url);
    } catch {
      setError('Error de red al cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={abrir}
        className="text-[var(--color-primary)] hover:text-blue-700 font-medium text-sm flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        Ver / Descargar
      </button>

      <FilePreviewModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        nombreArchivo={nombreArchivo}
        loading={loading}
        error={error}
      />
    </>
  );
}
