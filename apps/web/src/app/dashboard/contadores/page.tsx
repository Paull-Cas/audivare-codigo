import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import ContadoresList from './ContadoresList';
import PageHeader from '@/components/PageHeader';
import { ContadorIcon } from '@/components/icons';

async function getContadores(token: string) {
  const res = await fetch(`${getApiUrl()}/contadores`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return null;
    return { data: [] };
  }
  return res.json();
}

export default async function ContadoresPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return notFound();

  // Fetch data
  const resultContadores = await getContadores(token);

  if (!resultContadores) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-500 p-4 rounded-md">
          No tienes permisos para ver esta sección.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <PageHeader
          icon={<ContadorIcon className="w-6 h-6" />}
          title="Contadores externos"
          subtitle="Administra el acceso de los contadores externos a la plataforma"
          iconColor="text-cyan-600"
        />
      </div>

      <ContadoresList
        contadores={resultContadores.data || []}
      />
    </div>
  );
}
