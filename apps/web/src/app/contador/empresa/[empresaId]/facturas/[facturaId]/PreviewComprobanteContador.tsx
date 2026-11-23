'use client';

import { useState } from 'react';
import FilePreviewModal from '@/components/FilePreviewModal';

interface PreviewComprobanteContadorProps {
  url: string;
  nombreArchivo: string;
}

export default function PreviewComprobanteContador({
  url,
  nombreArchivo,
}: PreviewComprobanteContadorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ver comprobante"
        aria-label="Ver comprobante"
        className="inline-flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      </button>

      <FilePreviewModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        nombreArchivo={nombreArchivo}
      />
    </>
  );
}
