'use client';

import { useState, useRef } from 'react';

/**
 * Icono de ayuda contextual (ⓘ). Al hacer clic muestra un texto corto que
 * explica qué es y cómo se hace algo. El popover se posiciona con `fixed`
 * calculado desde el icono, para que nunca lo recorten contenedores con
 * `overflow-hidden` (tablas, tarjetas, modales).
 */
export default function AyudaTip({ titulo, texto }: { titulo?: string; texto: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const ancho = 256; // w-64
      const mitad = ancho / 2;
      const left = Math.min(Math.max(r.left + r.width / 2, mitad + 8), window.innerWidth - mitad - 8);
      setPos({ top: r.bottom + 8, left });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else abrir();
        }}
        aria-label="Ayuda"
        className="inline-flex items-center justify-center align-middle text-[var(--color-primary)] hover:text-blue-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0zM9 9a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0V9zm1-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[71] w-64 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {titulo && <div className="text-sm font-semibold text-gray-900 mb-1">{titulo}</div>}
            <div className="text-xs text-gray-600 leading-relaxed whitespace-normal font-normal normal-case tracking-normal">{texto}</div>
          </div>
        </>
      )}
    </>
  );
}
