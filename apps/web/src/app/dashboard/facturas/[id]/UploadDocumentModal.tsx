'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LocalFilePreview from '@/components/LocalFilePreview';
import FileInputES from '@/components/FileInputES';

export default function UploadDocumentModal({
  facturaId,
  apiBase,
}: {
  facturaId: string;
  // Base multipart. Empresa: `/api/facturas/:id` (default). Contador: `/api/contador/:empresaId/facturas/:id`.
  apiBase?: string;
}) {
  const base = apiBase ?? `/api/facturas/${facturaId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    if (!archivo) {
      alert('Debes adjuntar un archivo');
      return;
    }
    if (tipo === 'OTROS' && !(formData.get('descripcion') as string)?.trim()) {
      alert('Para el tipo "Otros" debes indicar qué documento es');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${base}/documentos`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setIsOpen(false);
        setArchivo(null);
        router.refresh();
      } else {
        alert('Error al subir el documento: ' + res.status);
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al subir el documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setArchivo(null); setTipo(''); setIsOpen(true); }}
        className="bg-white border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm"
      >
        Cargar documento
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Subir documento de sustento</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de documento</label>
                <select name="tipo_documento" required value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] bg-white">
                  <option value="">Selecciona un tipo...</option>
                  <option value="GUIA_REMISION_REMITENTE">Guía de remisión remitente</option>
                  <option value="GUIA_REMISION_TRANSPORTISTA">Guía de remisión transportista</option>
                  <option value="COTIZACION">Cotización o proforma</option>
                  <option value="CONTRATO">Contrato</option>
                  <option value="OTROS">Otro documento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {tipo === 'OTROS' ? 'Qué documento es' : 'Descripción (opcional)'}
                  {tipo === 'OTROS' && <span className="text-red-500"> *</span>}
                </label>
                <input type="text" name="descripcion" required={tipo === 'OTROS'} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]" placeholder={tipo === 'OTROS' ? 'Ej. Acta de conformidad' : 'Ej. Cotización de enero'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo</label>
                <FileInputES name="archivo" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" requerido onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-gray-500 mt-1.5">Formatos permitidos: PDF, PNG, JPG</p>
                <LocalFilePreview file={archivo} />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsOpen(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                  {loading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
