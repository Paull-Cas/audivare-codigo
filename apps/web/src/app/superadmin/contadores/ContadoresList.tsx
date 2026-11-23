'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmarEliminacion from '@/components/ConfirmarEliminacion';

export interface ContadorAdmin {
  id: string;
  nombre_completo: string | null;
  email: string;
  fecha_registro: string;
  empresas_vinculadas: number;
}

export default function ContadoresList({ contadores, puedeGestionar = false }: { contadores: ContadorAdmin[]; puedeGestionar?: boolean }) {
  const router = useRouter();
  const [eliminar, setEliminar] = useState<ContadorAdmin | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const confirmar = async () => {
    if (!eliminar) return;
    setEliminando(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/superadmin/contadores/${eliminar.id}`, method: 'DELETE' }),
      });
      if (res.ok) {
        setEliminar(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Error al eliminar el contador');
      }
    } catch {
      alert('Error de red al eliminar el contador');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Correo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Empresas vinculadas</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registro</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {contadores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">No hay contadores externos registrados</td>
                </tr>
              ) : (
                contadores.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text)]">
                      {c.nombre_completo || <span className="text-gray-400 italic">Sin nombre</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{c.empresas_vinculadas}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(c.fecha_registro).toLocaleDateString('es-ES')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {puedeGestionar ? (
                        <button
                          onClick={() => setEliminar(c)}
                          title="Eliminar contador"
                          aria-label="Eliminar contador"
                          className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {eliminar && (
        <ConfirmarEliminacion
          titulo="Eliminar contador"
          textoBoton="Eliminar contador"
          loading={eliminando}
          onCancelar={() => !eliminando && setEliminar(null)}
          onConfirmar={confirmar}
          mensaje={
            <>
              Vas a eliminar la cuenta del contador <strong>{eliminar.email}</strong>. Se desvinculará de sus empresas y no podrá iniciar sesión.
              El trabajo que haya hecho (facturas importadas, pagos, historial) se conserva en las empresas, pero sin su nombre. Esta acción es irreversible.
            </>
          }
        />
      )}
    </>
  );
}
