'use client';

import React, { useEffect, useState } from 'react';
import Spinner from '@/components/Spinner';
import PageHeader from '@/components/PageHeader';
import { AjustesIcon } from '@/components/icons';

interface EmpresaData {
  id: string;
  email_registro: string;
  ruc: string;
  razon_social: string;
  plan_suscripcion: string;
  estado_suscripcion: string;
  fecha_creacion: string;
}

export default function AjustesEmpresaPage() {
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    razon_social: ''
  });

  useEffect(() => {
    fetchEmpresa();
  }, []);

  const fetchEmpresa = async () => {
    try {
      const res = await fetch('/api/empresa');
      if (!res.ok) {
        if (res.status === 403) {
           setError('No tienes permiso para ver esta sección.');
        } else {
           setError('Error al cargar datos de la empresa');
        }
        return;
      }
      const data = await res.json();
      setEmpresa(data);
      setFormData({
        razon_social: data.razon_social || ''
      });
    } catch {
      setError('Error de red al cargar la empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al actualizar los datos');
      }

      const data = await res.json();
      setEmpresa(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Cargando ajustes..." />;
  if (!empresa) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<AjustesIcon className="w-6 h-6" />}
        title="Ajustes de Empresa"
        subtitle="Gestiona los datos principales y la suscripción de tu empresa."
        iconColor="text-teal-600"
      />

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        <form onSubmit={handleGuardar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* RUC (Solo lectura) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                RUC
                <span 
                  className="text-gray-400 cursor-help"
                  title="El RUC no puede modificarse"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </label>
              <input
                type="text"
                value={empresa.ruc || ''}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Email de registro (Solo lectura: identidad de Google) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                Email de registro
                <span
                  className="text-gray-400 cursor-help"
                  title="Es la cuenta de Google con la que se registró la empresa; no puede modificarse"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </label>
              <input
                type="email"
                value={empresa.email_registro || ''}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Razón Social */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Razón Social</label>
              <input
                type="text"
                required
                value={formData.razon_social}
                onChange={e => setFormData({ ...formData, razon_social: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
              />
            </div>
            
            {/* Plan de suscripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan de suscripción</label>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  empresa.plan_suscripcion === 'PROFESIONAL'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {empresa.plan_suscripcion === 'PROFESIONAL' ? 'Profesional' : 'Básico'}
                </span>
              </div>
            </div>

            {/* Estado de suscripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  empresa.estado_suscripcion === 'ACTIVO'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {empresa.estado_suscripcion === 'ACTIVO' ? 'Activo' : 'Suspendido'}
                </span>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            
            {error && <span className="text-sm text-red-600">{error}</span>}
            {success && <span className="text-sm text-green-600">Cambios guardados exitosamente</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
