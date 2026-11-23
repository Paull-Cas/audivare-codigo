'use client';

import { useState } from 'react';

export default function DownloadButton({
  facturaId,
  documentoId,
}: {
  facturaId: string;
  documentoId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/facturas/${facturaId}/documentos/${documentoId}/descargar`,
          method: 'GET',
        }),
      });

      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      } else {
        alert('Error al obtener el enlace de descarga');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="text-[var(--color-primary)] font-medium text-sm hover:underline disabled:opacity-50"
    >
      {loading ? 'Obteniendo...' : 'Descargar'}
    </button>
  );
}
