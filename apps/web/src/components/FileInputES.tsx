'use client';

import { useRef, useState } from 'react';

/**
 * Selector de archivo en español. El input nativo (<input type="file">) muestra
 * "Choose file / No file chosen" en el idioma del navegador y no se puede
 * traducir; por eso se oculta y se reemplaza por un botón + nombre en español.
 * Mantiene `name` (para FormData) y reenvía `onChange`. La obligatoriedad se
 * valida en JS en el formulario (no con `required`, que no aplica a inputs
 * ocultos), por eso aquí solo se marca visualmente con `requerido`.
 */
export default function FileInputES({
  name,
  accept,
  onChange,
  requerido = false,
  buttonLabel = 'Elegir archivo',
  disabled = false,
}: {
  name?: string;
  accept?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  requerido?: boolean;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3 border border-gray-300 rounded-md px-3 py-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="shrink-0 bg-blue-50 text-[var(--color-primary)] px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-100 transition-colors"
      >
        {buttonLabel}
      </button>
      <span className={`text-sm truncate ${nombre ? 'text-gray-700' : 'text-gray-400'}`}>
        {nombre ?? 'Ningún archivo seleccionado'}
      </span>
      {requerido && !nombre && <span className="text-red-500 text-sm ml-auto shrink-0">*</span>}
      <input
        ref={ref}
        type="file"
        disabled={disabled}
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          setNombre(e.target.files?.[0]?.name ?? null);
          onChange?.(e);
        }}
      />
    </div>
  );
}
