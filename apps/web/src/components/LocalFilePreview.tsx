'use client';

import { useEffect, useState } from 'react';

// Vista previa local de un archivo seleccionado (antes de subirlo).
// Soporta imágenes y PDF; para otros tipos muestra un aviso.
export default function LocalFilePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file || !url) return null;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const esImagen = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const esPdf = file.type === 'application/pdf' || ext === 'pdf';
  const tamano = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="mt-3 border border-[var(--color-border)] rounded-lg overflow-hidden bg-gray-50 shadow-sm">
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-white flex items-center gap-2 text-xs text-gray-600">
        <svg className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="font-medium text-gray-700">Vista previa</span>
        <span className="text-gray-400 truncate">· {file.name} ({tamano})</span>
      </div>
      <div className="h-64 flex items-center justify-center bg-gray-100">
        {esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
        ) : esPdf ? (
          <iframe src={url} title={file.name} className="w-full h-full" />
        ) : (
          <div className="text-xs text-gray-500 p-4 text-center">
            No hay vista previa disponible para este tipo de archivo.
          </div>
        )}
      </div>
    </div>
  );
}
