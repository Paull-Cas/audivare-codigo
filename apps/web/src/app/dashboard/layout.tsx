import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { SidebarProvider } from '@/context/SidebarContext';
import AccesoEmpresa from '@/components/AccesoEmpresa';
import AvisoCondiciones from '@/components/AvisoCondiciones';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  let user = null;
  try {
    const base64Payload = token.split('.')[1];
    const jsonPayload = Buffer.from(base64Payload, 'base64').toString('utf-8');
    user = JSON.parse(jsonPayload);
  } catch {
    // Si hay error decodificando, ignorar y seguir con user=null
  }

  // I6: los permisos se consultan siempre desde BD, nunca desde el JWT
  let permisos: string[] = [];
  let sinSesion = false;
  try {
    const res = await fetch(`${getApiUrl()}/perfil/permisos`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 403) return <AccesoEmpresa bloqueadoInicial />;
    if (res.status === 401) sinSesion = true;
    if (res.ok) {
      const data = await res.json();
      permisos = data.permisos || [];
    }
  } catch {
    // Si la API no responde, se ocultan las secciones con permiso requerido
  }

  if (sinSesion) redirect('/login');

  if (user) {
    user = { ...user, permisos };
  }

  return (
    <AccesoEmpresa>
    <SidebarProvider>
      <div className="flex h-screen app-surface overflow-hidden relative">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header user={user} />
          <main className="flex-1 overflow-auto p-6 md:p-8">
            <AvisoCondiciones usuarioId={user?.sub} />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </AccesoEmpresa>
  );
}
