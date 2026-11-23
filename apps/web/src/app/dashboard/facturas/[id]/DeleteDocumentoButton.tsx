'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteDocumentoButton({ facturaId, documentoId, apiBase }: { facturaId: string, documentoId: string, apiBase?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const base = apiBase ?? `/api/facturas/${facturaId}`;

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/documentos/${documentoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsOpen(false);
        setLoading(false);
        router.refresh();
      } else {
        const error = await res.json();
        alert(error.message || 'Error al eliminar el documento');
        setLoading(false);
        setIsOpen(false);
      }
    } catch {
      alert('Error de conexión');
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors ml-2"
        title="Eliminar documento"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-left">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar documento</h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Eliminar este documento? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={loading}
              >
                {loading ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
