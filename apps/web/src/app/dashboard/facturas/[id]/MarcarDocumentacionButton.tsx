'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MarcarDocumentacionButton({
  facturaId,
  completa,
  proxyBase,
}: {
  facturaId: string;
  completa: boolean;
  // Base del path de la API (vía /api/proxy). Empresa: `/facturas/:id` (default).
  // Contador: `/contador/empresas/:empresaId/facturas/:id`.
  proxyBase?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const base = proxyBase ?? `/facturas/${facturaId}`;

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${base}/documentacion`,
          method: 'PATCH',
          body: { completa: !completa },
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Error al actualizar la documentación');
      }
    } catch {
      alert('Error de red al actualizar la documentación');
    } finally {
      setLoading(false);
    }
  };

  if (completa) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Marcar como pendiente'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 btn-accent text-white px-3 py-2 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      {loading ? 'Guardando...' : 'Marcar documentación completa'}
    </button>
  );
}
