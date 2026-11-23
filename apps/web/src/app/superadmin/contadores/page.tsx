import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContadoresList, { type ContadorAdmin } from './ContadoresList';

export default async function SuperadminContadoresPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return notFound();

  const apiUrl = getApiUrl();
  const headers = { Authorization: `Bearer ${token}` };

  const [res, resPermisos] = await Promise.all([
    fetch(`${apiUrl}/superadmin/contadores`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/superadmin/mis-permisos`, { headers, cache: 'no-store' }),
  ]);

  if (!res.ok) {
    if (res.status === 403) return notFound();
    return <div className="text-red-600 p-4">Error cargando contadores</div>;
  }

  const { data } = (await res.json()) as { data: ContadorAdmin[] };
  const permisosSA: string[] = resPermisos.ok ? (await resPermisos.json()).permisos ?? [] : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        title="Contadores externos"
        subtitle="Contadores registrados en la plataforma y sus empresas vinculadas"
      />

      <ContadoresList contadores={data} puedeGestionar={permisosSA.includes('SA_EMPRESA_MANAGE')} />
    </div>
  );
}
