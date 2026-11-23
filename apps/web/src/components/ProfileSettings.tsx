'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Spinner from '@/components/Spinner';

interface ProfileData {
  nombre_completo?: string;
  email: string;
  tipo_usuario: string;
  fecha_registro: string;
}

export default function ProfileSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/perfil'); // We will proxy this in nextjs
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingName(true);
    setNameError('');
    setNameSuccess(false);

    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: profile.nombre_completo })
      });
      if (!res.ok) throw new Error('Error al actualizar nombre');
      setNameSuccess(true);
      router.refresh(); // To update header
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (e: unknown) {
      if (e instanceof Error) setNameError(e.message);
    } finally {
      setSavingName(false);
    }
  };

  if (loading) return <Spinner label="Cargando perfil..." />;
  if (!profile) return <div className="text-red-600">Error cargando perfil</div>;

  const initials = profile.nombre_completo?.substring(0, 2).toUpperCase() || profile.email.substring(0,2).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
          Perfil de Usuario
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestiona tus datos personales y configuración de seguridad
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Datos Personales */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Datos Personales</h2>
            </div>
            <form onSubmit={handleUpdateName} className="p-6 space-y-6">
              
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-3)] text-white flex items-center justify-center font-bold text-2xl tracking-widest shadow-lg">
                  {initials}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Avatar</h3>
                  <p className="text-sm text-gray-500 mt-1">Actualmente usamos tus iniciales como avatar.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={profile.nombre_completo || ''}
                    onChange={(e) => setProfile({...profile, nombre_completo: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (solo lectura)</label>
                  <input
                    type="email"
                    readOnly
                    value={profile.email}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de usuario</label>
                  <div className="h-[38px] flex items-center">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">
                      {profile.tipo_usuario}
                    </span>
                  </div>
                </div>
              </div>

              {nameError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{nameError}</div>}
              {nameSuccess && <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">Datos guardados exitosamente</div>}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingName}
                  className="btn-primary text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingName ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Panel Info (Derecha) */}
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Información de la Cuenta</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500">Fecha de registro</p>
                <p className="font-medium text-gray-900 mt-0.5">
                  {new Date(profile.fecha_registro).toLocaleDateString('es-PE', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Rol asignado</p>
                <p className="font-medium text-gray-900 mt-0.5">{profile.tipo_usuario}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
