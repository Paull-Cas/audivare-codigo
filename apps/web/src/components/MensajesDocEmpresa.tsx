'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fechaCorta } from '@/lib/fecha';

export interface MensajeDocEmpresa {
  id: string;
  contenido: string;
  de_contador: boolean;
  fecha_creacion: string;
  autor_nombre: string | null;
}

/**
 * Hilo de solicitudes/mensajes del módulo "Documentos de la empresa" entre el
 * contador y la empresa. Reutilizable en ambos lados: `basePath` es la ruta de
 * API (vía /api/proxy) para GET/POST, y `soyContador` decide de qué lado se
 * alinean "mis" mensajes.
 */
export default function MensajesDocEmpresa({
  mensajes,
  basePath,
  soyContador,
}: {
  mensajes: MensajeDocEmpresa[];
  basePath: string;
  soyContador: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: basePath, method: 'POST', body: { contenido } }),
      });
      if (res.ok) {
        setTexto('');
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.message || 'No se pudo enviar el mensaje');
      }
    } catch {
      setError('Error de red al enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const esMio = (m: MensajeDocEmpresa) => m.de_contador === soyContador;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6">
      <div className="flex items-center gap-2 border-b pb-4 mb-4">
        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        <h2 className="text-lg font-semibold text-gray-900">Solicitudes y mensajes</h2>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {soyContador
          ? 'Pídele a la empresa la documentación que necesitas: cronograma de préstamos, estados de cuenta bancario, contratos Leasing, etc. La empresa recibe una notificación y puede responderte aquí.'
          : 'Aquí tu contador te pide la documentación que necesita y pueden conversar. Al escribir, tu contador recibe una notificación.'}
      </p>

      <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
        {mensajes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-sm">
            Aún no hay mensajes. Escribe el primero abajo.
          </div>
        ) : (
          mensajes.map((m) => {
            const mio = esMio(m);
            return (
              <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mio ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${m.de_contador ? 'text-[var(--color-primary)]' : 'text-[var(--color-accent)]'}`}>
                      {m.de_contador ? 'Contador' : 'Empresa'}
                      {m.autor_nombre ? ` · ${m.autor_nombre}` : ''}
                    </span>
                    <span className="text-[11px] text-gray-400">{fechaCorta(m.fecha_creacion)}</span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.contenido}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <div className="mb-3 bg-red-50 text-red-600 p-2.5 rounded-md text-sm">{error}</div>}

      <form onSubmit={enviar} className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder={soyContador ? 'Ej. Necesito tus cronogramas de préstamo y el estado de cuenta de junio.' : 'Escribe tu respuesta…'}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] resize-none"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
