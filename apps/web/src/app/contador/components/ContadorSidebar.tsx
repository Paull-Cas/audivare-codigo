'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import React from 'react';
import { useSidebar } from '@/context/SidebarContext';
import AsistenciaButton from '@/components/AsistenciaButton';

const menuItems = [
  { 
    name: 'Mis empresas', 
    path: '/contador/dashboard', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> 
  },
  { 
    name: 'Notificaciones', 
    path: '/contador/notificaciones', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> 
  },
];

export default function ContadorSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();
  const [noLeidas, setNoLeidas] = React.useState(0);

  React.useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        const res = await fetch('/api/notificaciones');
        if (res.ok) {
          const data = await res.json();
          setNoLeidas(data.no_leidas);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotificaciones();
  }, [pathname]);



  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity"
          onClick={closeMobileSidebar}
        />
      )}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 h-full
          chrome-dark border-r border-white/10 flex flex-col flex-shrink-0
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`flex flex-col justify-center border-b border-white/10 ${isCollapsed ? 'h-16 px-0 items-center' : 'h-20 px-6'}`}>
          <div className={`flex items-center bg-white rounded-xl shadow-md ring-1 ring-white/40 ${isCollapsed ? 'p-1.5 justify-center' : 'gap-2.5 px-3 py-2 justify-center'}`}>
            <Image src="/logo-audivare.png" alt="Logo" width={24} height={24} className="object-contain flex-shrink-0" />
            {!isCollapsed && (
              <Image src="/titulo-audivare.png" alt="AudiVare" width={100} height={20} className="object-contain flex-shrink-0" />
            )}
          </div>
          {!isCollapsed && (
            <div className="mt-1 flex flex-col gap-0.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 w-fit">
                Contador Externo
              </span>
              {userName && (
                <span className="text-xs text-slate-400 truncate">{userName}</span>
              )}
            </div>
          )}
        </div>
        


        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                title={isCollapsed ? item.name : undefined}
                onClick={() => isMobileOpen && closeMobileSidebar()}
                className={`flex items-center rounded-md transition-colors text-sm ${
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                } ${isActive
                  ? 'nav-active-neon font-semibold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex-shrink-0 relative">
                    {item.icon}
                    {item.path === '/contador/notificaciones' && noLeidas > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {noLeidas}
                      </span>
                    )}
                </div>
                {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                        <span className="truncate">{item.name}</span>
                        {item.path === '/contador/notificaciones' && noLeidas > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {noLeidas}
                          </span>
                        )}
                    </div>
                )}
            </Link>
          );
        })}
        </nav>

        <div className={`border-t border-white/10 py-3 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          <AsistenciaButton isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}
