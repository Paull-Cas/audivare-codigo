import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import Header from '../dashboard/components/Header';
import SuperadminSidebar from './components/SuperadminSidebar';
import { SidebarProvider } from '@/context/SidebarContext';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  let user = null;
  if (token) {
    try {
      const base64Payload = token.split('.')[1];
      const jsonPayload = Buffer.from(base64Payload, 'base64').toString('utf-8');
      user = JSON.parse(jsonPayload);
    } catch {}
  }

  // Permisos de plataforma del superadmin: gatean los ítems del menú
  let permisosSA: string[] = [];
  if (token) {
    try {
      const res = await fetch(`${getApiUrl()}/superadmin/mis-permisos`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        permisosSA = data.permisos ?? [];
      }
    } catch {}
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen">
        <div className="flex h-screen app-surface relative overflow-hidden">
          <SuperadminSidebar user={user} permisosSA={permisosSA} />

          <div className="flex-1 flex flex-col min-w-0">
            <Header user={user} />
            <main className="flex-1 overflow-y-auto">
              <div className="p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
