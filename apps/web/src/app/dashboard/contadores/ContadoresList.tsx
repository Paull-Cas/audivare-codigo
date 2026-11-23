'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AyudaTip from '@/components/AyudaTip';

type Contador = {
  id: string | null;
  nombre_completo: string | null;
  email: string;
  fecha_vinculacion: string;
  estado: 'VINCULADO' | 'PENDIENTE';
};

export default function ContadoresList({
  contadores
}: {
  contadores: Contador[];
}) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '' });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [contadorADesvincular, setContadorADesvincular] = useState<Contador | null>(null);

  // El mensaje de éxito (en la página) desaparece automáticamente tras 4 segundos
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const abrirInvitar = () => {
    setInviteForm({ email: '' });
    setErrorMsg('');
    setShowInviteModal(true);
  };

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/contadores/invitar',
          method: 'POST',
          body: { email: inviteForm.email }
        })
      });

      if (res.ok) {
        // Enviada: se cierra el modal (evita reenvíos) y se avisa en la página.
        setShowInviteModal(false);
        setInviteForm({ email: '' });
        setSuccessMsg('Invitación enviada. Aparece abajo como “Invitación pendiente” hasta que el contador la acepte.');
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Error al invitar contador');
      }
    } catch {
      setErrorMsg('Error de red al invitar contador');
    } finally {
      setLoading(false);
    }
  };

  const handleDesvincular = async () => {
    if (!contadorADesvincular?.id) return;
    setLoading(true);

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/contadores/${contadorADesvincular.id}`,
          method: 'DELETE'
        })
      });

      if (res.ok) {
        setContadorADesvincular(null);
        router.refresh();
      } else {
        alert('Error al procesar la solicitud');
      }
    } catch {
      alert('Error de red');
    } finally {
      setLoading(false);
    }
  };

  const esPendiente = (c: Contador) => c.estado === 'PENDIENTE';

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="p-3 bg-green-50 text-green-800 border border-green-100 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center bg-gray-50 gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Contadores</h3>
            <AyudaTip
              titulo="Invitar a tu contador"
              texto="Pídele a tu contador externo el correo (Gmail) con el que ingresa a AudiVare y úsalo aquí para invitarlo. Al aceptar, tendrá acceso a tu empresa e importará tus facturas. Debe tener cuenta en AudiVare; si no, pídele que se registre primero como Contador."
            />
          </div>
          <button
            onClick={abrirInvitar}
            className="btn-primary text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Invitar contador
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 font-semibold">Nombre</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {contadores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aún no has invitado a ningún contador. Usa “Invitar contador” con su correo.
                  </td>
                </tr>
              ) : (
                contadores.map((contador) => (
                  <tr key={`${contador.email}-${contador.estado}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {contador.nombre_completo || <span className="text-gray-400 italic">Aún no ingresa</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {contador.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {esPendiente(contador) ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-medium">Invitación pendiente</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 text-[var(--color-accent)] px-2.5 py-0.5 text-xs font-medium">Vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(contador.fecha_vinculacion).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {contador.id ? (
                        <button
                          onClick={() => setContadorADesvincular(contador)}
                          className="text-red-600 hover:text-red-900 font-medium transition-colors"
                        >
                          {esPendiente(contador) ? 'Cancelar invitación' : 'Desvincular'}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Invitación */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setShowInviteModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Invitar contador externo</h3>
              <p className="text-sm text-gray-500 mb-4">Escribe el correo (Gmail) con el que tu contador ingresa a AudiVare.</p>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleInvitar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                    placeholder="usuario1@example.invalid"
                  />
                </div>

                <div className="pt-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    disabled={loading}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 btn-primary text-white rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación (desvincular o cancelar invitación) */}
      {contadorADesvincular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setContadorADesvincular(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {esPendiente(contadorADesvincular) ? 'Cancelar invitación' : 'Desvincular contador'}
              </h3>
              <p className="text-gray-600 mb-6">
                {esPendiente(contadorADesvincular) ? (
                  <>¿Cancelar la invitación a <span className="font-semibold text-gray-900">{contadorADesvincular.email}</span>? Podrás volver a invitarlo cuando quieras.</>
                ) : (
                  <>¿Seguro que deseas desvincular a <span className="font-semibold text-gray-900">{contadorADesvincular.nombre_completo || contadorADesvincular.email}</span> de tu empresa? Perderá acceso a todas las facturas inmediatamente.</>
                )}
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setContadorADesvincular(null)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleDesvincular}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : esPendiente(contadorADesvincular) ? 'Sí, cancelar' : 'Sí, desvincular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
