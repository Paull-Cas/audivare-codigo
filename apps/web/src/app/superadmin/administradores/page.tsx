import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import AdminsList from './AdminsList';
import PageHeader from '@/components/PageHeader';
import { UsuarioIcon } from '@/components/icons';

export default async function SuperadminAdministradoresPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return notFound();

  const apiUrl = getApiUrl();
  const headers = { Authorization: `Bearer ${token}` };

  const [resAdmins, resPermisos] = await Promise.all([
    fetch(`${apiUrl}/superadmin/admins`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/superadmin/permisos-disponibles`, { headers, cache: 'no-store' }),
  ]);

  if (!resAdmins.ok || !resPermisos.ok) {
    if (resAdmins.status === 403 || resPermisos.status === 403) {
      return (
        <div className="max-w-2xl mx-auto text-center py-16 text-gray-500 font-medium bg-white rounded-xl border border-gray-100 shadow-sm">
          No tienes permiso para gestionar administradores de la plataforma.
        </div>
      );
    }
    return <div className="text-red-600 p-4">Error cargando administradores</div>;
  }

  const { data: admins } = await resAdmins.json();
  const { data: permisosDisponibles } = await resPermisos.json();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        icon={<UsuarioIcon className="w-6 h-6" />}
        title="Administradores de la plataforma"
        subtitle="Superadmins con acceso al panel; cada uno con sus permisos."
      />

      <AdminsList admins={admins} permisosDisponibles={permisosDisponibles} />
    </div>
  );
}
