'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResponderSolicitudButton({
  facturaId,
  solicitudId,
}: {
  facturaId: string;
  solicitudId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const responder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/facturas/${facturaId}/observaciones/${solicitudId}/atender`,
          method: 'PATCH',
          body: { respuesta },
        }),
      });
      if (res.ok) {
        setOpen(false);
        setRespuesta('');
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Error al responder la solicitud');
      }
    } catch {
      setError('Error de red al responder la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setError(null); setRespuesta(''); setOpen(true); }}
        className="inline-flex items-center gap-1.5 btn-primary text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-sm"
      >
        Responder
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Responder solicitud</h2>
              <button onClick={() => !loading && setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
              <p className="text-sm text-gray-500">
                Marca la solicitud como atendida. Puedes dejar una nota (ej. &quot;ya subí la guía&quot; o &quot;disculpa, no la tengo&quot;). El documento se carga aparte, en la sección de documentación.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota (opcional)</label>
                <textarea
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] min-h-[90px]"
                  placeholder="Escribe una respuesta para el contador..."
                />
              </div>
              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setOpen(false)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={responder} disabled={loading} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Marcar atendida'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
