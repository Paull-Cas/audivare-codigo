'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';
import AsistenciaButton from '@/components/AsistenciaButton';

const menuItems = [
  { name: 'Privacidad y actividad', path: '/superadmin/privacidad', permiso: 'SA_SUPERADMIN_MANAGE',
    icon: <span className="w-5 h-5 flex-shrink-0" aria-hidden="true">◎</span> },
  {
    name: 'Dashboard',
    path: '/superadmin/dashboard',
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    name: 'Empresas',
    path: '/superadmin/empresas',
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    name: 'Contadores',
    path: '/superadmin/contadores',
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    name: 'Notificaciones',
    path: '/superadmin/notificaciones',
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  },
  {
    name: 'Administradores',
    path: '/superadmin/administradores',
    permiso: 'SA_SUPERADMIN_MANAGE',
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
];

export default function SuperadminSidebar({ user, permisosSA = [] }: { user?: { email?: string } | null; permisosSA?: string[] }) {
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();
  const pathname = usePathname();
  const itemsVisibles = menuItems.filter((item) => !item.permiso || permisosSA.includes(item.permiso));

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity"
          onClick={closeMobileSidebar}
        />
      )}
      
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 h-full
          chrome-dark border-r border-white/10 flex flex-col justify-between
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div>
          <div className={`flex flex-col border-b border-white/10 ${isCollapsed ? 'p-4 items-center' : 'p-6'}`}>
            <div className={`flex items-center bg-white rounded-xl shadow-md ring-1 ring-white/40 ${isCollapsed ? 'p-1.5 justify-center' : 'gap-2.5 px-3 py-2 justify-center'}`}>
              <Image src="/logo-audivare.png" alt="Logo" width={28} height={28} className="object-contain" />
              {!isCollapsed && (
                <Image src="/titulo-audivare.png" alt="AudiVare" width={110} height={24} className="object-contain" />
              )}
            </div>
            {!isCollapsed && (
              <div className="mt-1 flex flex-col gap-0.5">
                <span className="bg-green-100 text-[var(--color-accent)] text-xs font-semibold px-2 py-0.5 rounded-full w-fit">Superadmin</span>
                {user?.email && (
                  <span className="text-xs text-slate-400 truncate">{user.email}</span>
                )}
              </div>
            )}
          </div>



          <nav className="px-3 mt-4 space-y-1">
            {itemsVisibles.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => isMobileOpen && closeMobileSidebar()}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center py-2.5 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                    isActive
                      ? 'nav-active-neon font-semibold'
                      : 'text-slate-300 font-medium hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={isCollapsed ? '' : 'mr-3'}>{item.icon}</span>
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={`border-t border-white/10 py-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          <AsistenciaButton isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}
