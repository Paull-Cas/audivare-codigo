import React from 'react';
import { cookies } from 'next/headers';
import ContadorSidebar from './components/ContadorSidebar';
import { notFound } from 'next/navigation';
import Header from '../dashboard/components/Header';
import { SidebarProvider } from '@/context/SidebarContext';
import AvisoCondiciones from '@/components/AvisoCondiciones';

export default async function ContadorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return notFound();
  }

  // Parse token
  let payload: { sub?: string; email?: string; nombre_completo?: string; tipo_usuario?: string } = {};
  try {
    const payloadBase64 = token.split('.')[1];
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(atob(base64));
  } catch {
    return notFound();
  }

  const user = {
    nombre: payload.nombre_completo || payload.email || 'Contador Externo',
    rol: 'Contador Externo',
    sub: payload.sub || '',
    email: payload.email || '',
    tipo_usuario: payload.tipo_usuario || 'CONTADOR',
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen app-surface text-[var(--color-text)] relative overflow-hidden">
        <ContadorSidebar userName={user.nombre} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={user} />
          <main className="flex-1 overflow-y-auto">
            <AvisoCondiciones usuarioId={user.sub} />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
