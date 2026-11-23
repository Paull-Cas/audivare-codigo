import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import UsuariosList from './UsuariosList';
import PageHeader from '@/components/PageHeader';
import { UsuarioIcon } from '@/components/icons';

export default async function UsuariosPage() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return notFound();

  // Parse token to get user info
  let payload: { sub?: string } = {};
  try {
    const payloadBase64 = token.split('.')[1];
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(atob(base64));
  } catch {
    return notFound();
  }

  const apiUrl = getApiUrl();
  const [resUsuarios, resRoles, resEmpresa] = await Promise.all([
    fetch(`${apiUrl}/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/usuarios/roles`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/empresa`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  ]);

  if (!resUsuarios.ok) {
    if (resUsuarios.status === 403) return notFound();
    return <div className="text-red-600 p-4">Error cargando usuarios</div>;
  }

  const resultUsuarios = await resUsuarios.json();
  const resultRoles = await resRoles.json();
  const limiteUsuarios: number | null = resEmpresa.ok
    ? (await resEmpresa.json()).limite_usuarios ?? null
    : null;
  const totalUsuarios = (resultUsuarios.data || []).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={<UsuarioIcon className="w-6 h-6" />}
        title="Gestión de usuarios"
        subtitle={limiteUsuarios !== null
          ? `Administra los accesos internos a la plataforma (${totalUsuarios} de ${limiteUsuarios} usuarios)`
          : 'Administra los accesos internos a la plataforma'}
        iconColor="text-indigo-600"
      />

      <UsuariosList
        usuarios={resultUsuarios.data || []}
        roles={resultRoles.data || []}
        currentUserId={payload.sub || ''}
      />
    </div>
  );
}
