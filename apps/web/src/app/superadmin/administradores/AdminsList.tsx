'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface AdminPlataforma {
  id: string;
  email: string;
  nombre_completo: string | null;
  es_principal: boolean;
  fecha_registro: string;
  permisos: string[];
}

export interface PermisoSA {
  codigo: string;
  descripcion: string;
}

export default function AdminsList({
  admins,
  permisosDisponibles,
}: {
  admins: AdminPlataforma[];
  permisosDisponibles: PermisoSA[];
}) {
  const router = useRouter();

  // Modal de creación / edición (si editando es null, el modal crea)
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<AdminPlataforma | null>(null);
  const [email, setEmail] = useState('');
  const [permisos, setPermisos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal de eliminación
  const [aEliminar, setAEliminar] = useState<AdminPlataforma | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState('');

  const abrirCrear = () => {
    setEditando(null);
    setEmail('');
    setPermisos([]);
    setErrorMsg('');
    setShowModal(true);
  };

  const abrirEditar = (admin: AdminPlataforma) => {
    setEditando(admin);
    setEmail(admin.email);
    setPermisos(admin.permisos);
    setErrorMsg('');
    setShowModal(true);
  };

  const togglePermiso = (codigo: string) => {
    setPermisos((prev) =>
      prev.includes(codigo) ? prev.filter((p) => p !== codigo) : [...prev, codigo]
    );
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editando
            ? { path: `/superadmin/admins/${editando.id}/permisos`, method: 'PATCH', body: { permisos } }
            : { path: '/superadmin/admins', method: 'POST', body: { email, permisos } }
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Error al guardar');
        return;
      }

      setShowModal(false);
      router.refresh();
    } catch {
      setErrorMsg('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    setEliminarError('');

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/superadmin/admins/${aEliminar.id}`, method: 'DELETE' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEliminarError(data.message || 'Error al eliminar');
        return;
      }

      setAEliminar(null);
      router.refresh();
    } catch {
      setEliminarError('Error de red al eliminar');
    } finally {
      setEliminando(false);
    }
  };

  const nombrePermiso = (codigo: string) =>
    permisosDisponibles.find((p) => p.codigo === codigo)?.descripcion || codigo;

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={abrirCrear}
          className="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Agregar administrador
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permisos</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text)]">
                    {a.nombre_completo || <span className="text-gray-400">—</span>}
                    {a.es_principal && (
                      <span className="ml-2 text-xs bg-blue-100 text-[var(--color-primary)] px-2 py-0.5 rounded-full">Principal</span>
                    )}
                    {!a.nombre_completo && (
                      <span
                        className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                        title="Fue agregado pero nunca ha iniciado sesión con su cuenta de Google."
                      >
                        Aún no ingresa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{a.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {a.es_principal ? (
                      <span className="text-xs font-medium text-gray-500">Acceso total</span>
                    ) : a.permisos.length === 0 ? (
                      <span className="text-xs text-gray-400">Solo lectura</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.permisos.map((p) => (
                          <span key={p} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full" title={nombrePermiso(p)}>
                            {p === 'SA_EMPRESA_MANAGE' ? 'Empresas' : p === 'SA_SUPERADMIN_MANAGE' ? 'Administradores' : p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                    {!a.es_principal && (
                      <>
                        <button
                          onClick={() => abrirEditar(a)}
                          className="text-sm px-3 py-1.5 rounded-md font-medium text-[var(--color-primary)] hover:bg-blue-50 transition-colors"
                        >
                          Editar permisos
                        </button>
                        <button
                          onClick={() => { setAEliminar(a); setEliminarError(''); }}
                          className="ml-1 text-sm px-3 py-1.5 rounded-md font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editando ? 'Editar permisos' : 'Agregar administrador'}
            </h3>

            {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo de Google</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!!editando}
                  required={!editando}
                  className={`w-full px-3 py-2 border border-[var(--color-border)] rounded-lg outline-none ${
                    editando
                      ? 'bg-gray-50 text-gray-500 cursor-not-allowed'
                      : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="usuario1@example.invalid"
                  disabled={saving}
                />
                {!editando && (
                  <p className="text-xs text-gray-500 mt-1">Ingresará con su cuenta de Google; sin contraseñas.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permisos</label>
                <div className="space-y-2">
                  {permisosDisponibles.map((p) => (
                    <label key={p.codigo} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permisos.includes(p.codigo)}
                        onChange={() => togglePermiso(p.codigo)}
                        disabled={saving}
                        className="mt-0.5"
                      />
                      <span>{p.descripcion}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Sin permisos marcados, solo podrá ver el dashboard y la lista de empresas.</p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 btn-primary text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {aEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar administrador</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Seguro que deseas eliminar a <strong>{aEliminar.nombre_completo || aEliminar.email}</strong>?
              Perderá el acceso al panel de administración de inmediato.
            </p>

            {eliminarError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{eliminarError}</div>}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAEliminar(null)}
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
    </>
  );
}
