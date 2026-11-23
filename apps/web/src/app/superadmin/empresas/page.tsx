import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import EmpresasList from './EmpresasList';
import PageHeader from '@/components/PageHeader';
import { EmpresaIcon } from '@/components/icons';

export default async function SuperadminEmpresasPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return notFound();

  const apiUrl = getApiUrl();
  const headers = { Authorization: `Bearer ${token}` };

  const [res, resPermisos] = await Promise.all([
    fetch(`${apiUrl}/superadmin/empresas`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/superadmin/mis-permisos`, { headers, cache: 'no-store' }),
  ]);

  if (!res.ok) {
    if (res.status === 403) return notFound();
    return <div className="text-red-600 p-4">Error cargando empresas</div>;
  }

  const { data } = await res.json();
  const permisosSA: string[] = resPermisos.ok ? (await resPermisos.json()).permisos ?? [] : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={<EmpresaIcon className="w-6 h-6" />}
        title="Empresas registradas"
        subtitle="Gestión de empresas y estados de suscripción"
      />

      <EmpresasList empresas={data} puedeGestionar={permisosSA.includes('SA_EMPRESA_MANAGE')} />
    </div>
  );
}
