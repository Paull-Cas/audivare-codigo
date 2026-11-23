import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

export default async function SuperadminDashboardPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return notFound();

  const res = await fetch(`${getApiUrl()}/superadmin/empresas`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 403) return notFound(); // Should be caught by middleware normally, but fallback
    return <div className="text-red-600 p-4">Error cargando dashboard</div>;
  }

  const result = await res.json();
  const empresas = result.data || [];
  const totalEmpresas = result.total || 0;
  
  interface EmpresaInfo {
    estado_suscripcion: string;
  }
  const empresasActivas = empresas.filter((e: EmpresaInfo) => e.estado_suscripcion === 'ACTIVO').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Panel de administración</h1>
        <p className="text-gray-500 mt-1">Resumen general de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/80 p-6 rounded-2xl border border-white/70 card-elevated flex items-center">
          <div className="p-3 bg-blue-50 text-[var(--color-primary)] rounded-lg mr-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total empresas</p>
            <p className="text-3xl font-bold text-[var(--color-text)] mt-1">{totalEmpresas}</p>
          </div>
        </div>

        <div className="bg-white/80 p-6 rounded-2xl border border-white/70 card-elevated flex items-center">
          <div className="p-3 bg-green-50 text-[var(--color-accent)] rounded-lg mr-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Empresas activas</p>
            <p className="text-3xl font-bold text-[var(--color-text)] mt-1">{empresasActivas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
