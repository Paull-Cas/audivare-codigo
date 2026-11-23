'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UsuarioInterno {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  rolId?: string;
  estado: boolean;
}

export interface Rol {
  id: string;
  nombre: string;
}

export default function UsuariosList({
  usuarios,
  roles,
  currentUserId
}: {
  usuarios: UsuarioInterno[];
  roles: Rol[];
  currentUserId: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [rolId, setRolId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioInterno | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState('');

  const router = useRouter();

  // Los mensajes de éxito/error desaparecen automáticamente tras 3 segundos
  useEffect(() => {
    if (!successMsg && !errorMsg) return;
    const t = setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 3000);
    return () => clearTimeout(t);
  }, [successMsg, errorMsg]);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !rolId) {
      setErrorMsg('El correo y el rol son obligatorios');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/usuarios/invitar',
          method: 'POST',
          body: { email, rol_id: rolId }
        })
      });

      if (res.ok) {
        setSuccessMsg('Usuario invitado exitosamente. Ya puede ingresar con su correo electrónico.');
        setEmail('');
        setRolId('');
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Error al invitar usuario');
      }
    } catch {
      setErrorMsg('Error de red al invitar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEstado = async (userId: string, currentEstado: boolean) => {
    if (userId === currentUserId && currentEstado) {
      alert('No puedes desactivarte a ti mismo');
      return;
    }

    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/usuarios/${userId}/estado`,
          method: 'PATCH',
          body: { estado: !currentEstado }
        })
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al cambiar estado');
      }
    } catch {
      alert('Error de red al cambiar estado');
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!usuarioAEliminar) return;

    setEliminando(true);
    setEliminarError('');

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/usuarios/${usuarioAEliminar.id}`,
          method: 'DELETE'
        })
      });

      if (res.ok) {
        setUsuarioAEliminar(null);
        router.refresh();
      } else {
        const data = await res.json();
        setEliminarError(data.message || 'Error al eliminar usuario');
      }
    } catch {
      setEliminarError('Error de red al eliminar usuario');
    } finally {
      setEliminando(false);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string, newRolId: string) => {
    const roleName = roles.find(r => r.id === newRolId)?.nombre || 'Desconocido';
    if (!window.confirm(`¿Cambiar rol de ${usuarios.find(u => u.id === userId)?.nombre_completo} a ${roleName}?`)) {
      // Re-render to reset select if user cancels
      router.refresh();
      return;
    }

    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/usuarios/${userId}/rol`,
          method: 'PATCH',
          body: { rol_id: newRolId }
        })
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al cambiar de rol');
      }
    } catch {
      alert('Error de red al cambiar de rol');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Usuarios activos</h2>
        <button
          onClick={() => {
            setShowModal(true);
            setSuccessMsg('');
            setErrorMsg('');
          }}
          className="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Invitar usuario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">No hay usuarios registrados</td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text)]">
                      {u.nombre_completo || <span className="text-gray-400">—</span>}
                      {u.id === currentUserId && <span className="ml-2 text-xs bg-blue-100 text-[var(--color-primary)] px-2 py-0.5 rounded-full">Tú</span>}
                      {!u.nombre_completo && (
                        <span
                          className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                          title="Este usuario fue invitado pero nunca ha iniciado sesión. Si el correo es incorrecto, elimínalo y vuelve a invitar."
                        >
                          Aún no ingresa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <select 
                        value={u.rolId || ''}
                        onChange={(e) => handleRoleChange(u.id, u.rol, e.target.value)}
                        disabled={actionLoadingId === u.id || u.rol === 'Administrador'}
                        className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 text-gray-600"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                        {/* Fallback if role is not in the list (e.g. for some reason) */}
                        {!roles.find(r => r.id === u.rolId) && u.rol && (
                          <option value={u.rolId || ''}>{u.rol}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.estado ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-[var(--color-accent)] rounded-full">Activo</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">Inactivo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <button
                        onClick={() => handleToggleEstado(u.id, u.estado)}
                        disabled={actionLoadingId === u.id || (u.id === currentUserId && u.estado)}
                        className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                          u.estado
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-[var(--color-accent)] hover:bg-green-50'
                        } disabled:opacity-50`}
                      >
                        {actionLoadingId === u.id ? '...' : u.estado ? 'Desactivar' : 'Activar'}
                      </button>
                      {u.id !== currentUserId && u.rol !== 'Administrador' && (
                        <button
                          onClick={() => { setUsuarioAEliminar(u); setEliminarError(''); }}
                          disabled={actionLoadingId === u.id}
                          className="ml-1 text-sm px-3 py-1.5 rounded-md font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {usuarioAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar usuario</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Seguro que deseas eliminar a <strong>{usuarioAEliminar.nombre_completo || usuarioAEliminar.email}</strong> de la empresa?
              Perderá todo acceso de inmediato y se liberará un cupo de usuarios. Podrás volver a invitarlo con el mismo correo si lo necesitas.
            </p>

            {eliminarError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{eliminarError}</div>}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUsuarioAEliminar(null)}
                disabled={eliminando}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                disabled={eliminando}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Invitar usuario</h3>
            
            {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}
            {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMsg}</div>}

            <form onSubmit={handleInvitar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="usuario1@example.invalid"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol en la empresa</label>
                <select 
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={loading}
                >
                  <option value="">Seleccione un rol</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 btn-primary text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Invitando...' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
