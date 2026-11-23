'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSidebar } from '@/context/SidebarContext';
import IconoTipoNotificacion from '@/components/NotificacionIcon';

interface UserData {
  sub: string;
  email: string;
  tipo_usuario: string;
  nombre_completo?: string;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  fechaCreacion: string;
  leida: boolean;
  metadata?: {
    documento_mensual?: boolean;
    invitacion_id?: string;
    empresa_nombre?: string;
    factura_id?: string;
    empresa_id?: string;
  };
}

const TIPO_USUARIO_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Administrador',
  INTERNO: 'Usuario Interno',
  CONTADOR_EXTERNO: 'Contador Externo',
};

export default function Header({ user }: { user: UserData | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotificaciones = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/notificaciones');
        if (res.ok) {
          const data = await res.json();
          setNotificaciones(data.data.slice(0, 5));
          setNoLeidas(data.no_leidas);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchNotificaciones();
  }, [user]);

  const handleAction = async (action: 'aceptar' | 'rechazar', invitacionId: string) => {
    try {
      await fetch(`/api/contadores/invitaciones/${invitacionId}/${action}`, { method: 'POST' });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarcarLeidas = async () => {
    try {
      await fetch('/api/notificaciones/leer-todas', { method: 'PATCH' });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  // Al clic en una notificación del dropdown: cerrar, marcar leída y ajustar el contador.
  const marcarLeidaYCerrar = (n: Notificacion) => {
    setNotifOpen(false);
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    setNoLeidas((prev) => Math.max(0, prev - 1));
    fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PATCH' }).catch(() => {});
  };

  const handleLogout = async () => {
    setLogoutError('');
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout');
      router.push('/login');
      router.refresh();
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Inténtalo nuevamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  const email = user?.email || 'usuario1@example.invalid';
  const name = user?.nombre_completo || email.split('@')[0];
  const initials = name.substring(0, 2).toUpperCase();
  
  let profilePath = '/dashboard/perfil';
  if (pathname?.startsWith('/contador')) {
    profilePath = '/contador/perfil';
  } else if (pathname?.startsWith('/superadmin')) {
    profilePath = '/superadmin/perfil';
  }

  return (
    <header className="h-16 border-b border-white/10 chrome-dark flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 text-slate-300 hover:text-white transition-colors focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button
          onClick={toggleSidebar}
          className="hidden lg:block p-2 text-slate-300 hover:text-white transition-colors focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-6 ml-auto">
        {user && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false); }}
              className="relative p-2 text-slate-300 hover:text-white transition-colors focus:outline-none"
              aria-label="Notificaciones"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {noLeidas > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {noLeidas}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-semibold text-sm">Notificaciones</h3>
                  <Link href={user.tipo_usuario === 'CONTADOR_EXTERNO' ? "/contador/notificaciones" : user.tipo_usuario === 'SUPERADMIN' ? "/superadmin/notificaciones" : "/dashboard/notificaciones"} onClick={() => setNotifOpen(false)} className="text-xs text-[var(--color-primary)] hover:underline">
                    Ver todas
                  </Link>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No tienes notificaciones</div>
                  ) : (
                    notificaciones.map((n) => {
                      // Enlace a la factura según el tipo de usuario (si la notificación la referencia)
                      const enlaceFactura = n.metadata?.documento_mensual
                        ? (user?.tipo_usuario === 'CONTADOR_EXTERNO' && n.metadata.empresa_id ? `/contador/empresa/${n.metadata.empresa_id}` : '/dashboard/documentos-mensuales')
                        : n.metadata?.factura_id
                        ? (user?.tipo_usuario === 'CONTADOR_EXTERNO'
                            ? (n.metadata?.empresa_id ? `/contador/empresa/${n.metadata.empresa_id}/facturas/${n.metadata.factura_id}` : null)
                            : `/dashboard/facturas/${n.metadata.factura_id}`)
                        : null;

                      const cuerpo = (
                        <div className="flex gap-2">
                          <IconoTipoNotificacion tipo={n.tipo} size="sm" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{n.titulo}</p>
                            <p className="text-gray-600 mt-0.5 text-xs">{n.mensaje}</p>
                            {enlaceFactura && (
                              <span className="inline-block mt-1 text-xs font-medium text-[var(--color-primary)]">Ver documentos →</span>
                            )}
                            {n.tipo === 'INVITACION_EMPRESA' && n.metadata?.invitacion_id && (
                              <div className="mt-2 flex gap-2">
                                <button onClick={() => {
                                  if (n.metadata?.invitacion_id) handleAction('aceptar', n.metadata.invitacion_id)
                                }} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors">Aceptar</button>
                                <button onClick={() => {
                                  if (n.metadata?.invitacion_id) handleAction('rechazar', n.metadata.invitacion_id)
                                }} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors">Rechazar</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );

                      const claseItem = `block p-4 border-b border-gray-50 text-sm ${!n.leida ? 'bg-blue-50' : 'bg-white'}`;
                      return enlaceFactura ? (
                        <Link key={n.id} href={enlaceFactura} onClick={() => marcarLeidaYCerrar(n)} className={`${claseItem} hover:bg-blue-50/70 transition-colors`}>
                          {cuerpo}
                        </Link>
                      ) : (
                        <div key={n.id} className={claseItem}>
                          {cuerpo}
                        </div>
                      );
                    })
                  )}
                </div>
                {notificaciones.length > 0 && (
                  <button onClick={handleMarcarLeidas} className="w-full p-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50 border-t border-gray-100">
                    Marcar todas como leídas
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {user && (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
            >
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-medium text-white capitalize truncate max-w-[120px]">{name}</span>
                <span className="text-xs text-slate-400">{(user?.tipo_usuario && TIPO_USUARIO_LABELS[user.tipo_usuario]) || 'Usuario'}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-3)] text-white flex items-center justify-center font-bold text-sm tracking-widest shadow-md">
                {initials}
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100 z-50">
                <button
                  onClick={() => { setDropdownOpen(false); router.push(profilePath); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Mi perfil
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button 
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                >
                  {loggingOut ? 'Cerrando sesión…' : 'Cerrar Sesión'}
                </button>
                {logoutError && <p role="alert" className="px-4 py-2 text-sm text-red-600">{logoutError}</p>}
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
