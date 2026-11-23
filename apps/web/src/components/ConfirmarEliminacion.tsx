'use client';

import { useState } from 'react';

/**
 * Modal de confirmación para acciones destructivas: exige escribir una palabra
 * (por defecto "ELIMINAR") para habilitar el botón. Evita borrados accidentales.
 */
export default function ConfirmarEliminacion({
  titulo,
  mensaje,
  palabra = 'ELIMINAR',
  textoBoton = 'Eliminar',
  loading = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensaje: React.ReactNode;
  palabra?: string;
  textoBoton?: string;
  loading?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState('');
  const habilitado = valor.trim().toUpperCase() === palabra.toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4" onClick={() => !loading && onCancelar()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </span>
          <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
        </div>

        <div className="text-sm text-gray-600 mb-4">{mensaje}</div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Escribe <span className="font-mono font-bold text-red-600">{palabra}</span> para confirmar
        </label>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
          placeholder={palabra}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 mb-4"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!habilitado || loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Eliminando...' : textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
