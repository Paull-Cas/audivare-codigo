'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EnviarObservacionProps {
  empresaId: string;
  facturaId: string;
}

export default function EnviarObservacion({ empresaId, facturaId }: EnviarObservacionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contenido, setContenido] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setOpen(false);
    setContenido('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (contenido.trim() === '') {
      setError('Escribe qué necesitas de la empresa');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/contador/empresas/${empresaId}/facturas/${facturaId}/observaciones`,
          method: 'POST',
          body: { contenido: contenido.trim() },
        }),
      });
      const data = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Error al enviar la solicitud');
        return;
      }
      handleClose();
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
      >
        Enviar solicitud
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Solicitar documentación a la empresa</h3>
            <p className="text-sm text-gray-500">La empresa recibirá una notificación y podrá responderte y cargar el documento.</p>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={4}
              placeholder="Ej. Súbeme la guía de remisión de esta factura, la necesito urgente."
              className="w-full border border-gray-300 rounded-md p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
