'use client';
import React, { useEffect, useState } from 'react';
import Spinner from '@/components/Spinner';
import PageHeader from '@/components/PageHeader';
import { RolIcon } from '@/components/icons';

interface Role {
  id: string;
  nombre_rol: string;
  descripcion: string;
  es_inmutable: boolean;
  permisos: string[];
}

const PERMISOS_GROUPED = {
  Documentos: [
    { id: 'DOCUMENTO_MENSUAL_READ', label: 'Consultar documentos y actividad' },
    { id: 'DOCUMENTO_MENSUAL_CREATE', label: 'Cargar facturas y sustentos' },
    { id: 'DOCUMENTO_MENSUAL_UPDATE', label: 'Editar periodo y nota' },
    { id: 'DOCUMENTO_MENSUAL_DELETE', label: 'Eliminar documentos' }
  ],
  'Documentos de empresa': [
    { id: 'DOCUMENTO_EMPRESA_MANAGE', label: 'Gestionar documentos generales y mensajes' }
  ],
  Administración: [
    { id: 'USUARIO_MANAGE', label: 'Gestionar usuarios' },
    { id: 'ROL_MANAGE', label: 'Gestionar roles' },
    { id: 'CONTADOR_INVITE', label: 'Invitar contadores' }
  ]
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ nombre_rol: '', descripcion: '', permisos: [] as string[] });
  
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/roles', method: 'GET' })
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({ nombre_rol: role.nombre_rol, descripcion: role.descripcion || '', permisos: role.permisos || [] });
    } else {
      setEditingRole(null);
      setFormData({ nombre_rol: '', descripcion: '', permisos: [] });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  const handleTogglePermiso = (permisoId: string) => {
    setFormData(prev => ({
      ...prev,
      permisos: prev.permisos.includes(permisoId)
        ? prev.permisos.filter(p => p !== permisoId)
        : [...prev.permisos, permisoId]
    }));
  };

  const handleSave = async () => {
    try {
      const path = editingRole ? `/roles/${editingRole.id}` : '/roles';
      const method = editingRole ? 'PATCH' : 'POST';
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, method, body: formData })
      });

      if (res.ok) {
        handleCloseModal();
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.message || 'Error al guardar el rol');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`¿Eliminar rol ${role.nombre_rol}?`)) return;
    
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/roles/${role.id}`, method: 'DELETE' })
      });
      if (res.ok) {
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.message || 'Error al eliminar el rol');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RolIcon className="w-6 h-6" />}
        title="Roles y Permisos"
        subtitle="Define roles y controla los permisos de cada acceso"
        iconColor="text-amber-600"
        actions={
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Nuevo rol
          </button>
        }
      />

      {loading ? (
        <Spinner label="Cargando roles..." />
      ) : roles.length === 0 ? (
        <div className="text-center py-10 text-gray-500 font-medium bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
          No hay roles creados
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role.id} className="bg-white border border-[var(--color-border)] rounded-lg p-5 flex flex-col shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-[var(--color-text)]">{role.nombre_rol}</h3>
                {role.es_inmutable && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">Inmutable</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4 flex-1">{role.descripcion || 'Sin descripción'}</p>
              
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permisos clave</div>
                <div className="flex flex-wrap gap-2">
                  {role.es_inmutable ? (
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded border border-blue-100">Acceso total</span>
                  ) : (
                    role.permisos.slice(0, 3).map(p => (
                      <span key={p} className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded border border-green-100">
                        {p.split('_')[0]}
                      </span>
                    ))
                  )}
                  {!role.es_inmutable && role.permisos.length > 3 && (
                    <span className="bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">
                      +{role.permisos.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {!role.es_inmutable && (
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => handleOpenModal(role)}
                    className="text-[var(--color-primary)] hover:text-blue-700 text-sm font-medium px-2 py-1"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(role)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
              </h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del rol</label>
                  <input
                    type="text"
                    value={formData.nombre_rol}
                    onChange={e => setFormData({ ...formData, nombre_rol: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    placeholder="Ej. Contador Senior"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    placeholder="Describe las responsabilidades del rol"
                    rows={2}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Permisos</h3>
                <div className="space-y-6">
                  {Object.entries(PERMISOS_GROUPED).map(([category, permisos]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{category}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {permisos.map(permiso => (
                          <label key={permiso.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permisos.includes(permiso.id)}
                              onChange={() => handleTogglePermiso(permiso.id)}
                              className="mt-1 border-gray-300 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{permiso.label}</span>
                              <span className="text-xs text-gray-500">{permiso.id}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.nombre_rol}
                className="px-4 py-2 text-sm font-medium text-white btn-primary rounded-md disabled:opacity-50 transition-colors"
              >
                {editingRole ? 'Guardar cambios' : 'Crear rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
