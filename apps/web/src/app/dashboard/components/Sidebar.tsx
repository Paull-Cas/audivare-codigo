'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useSidebar } from '@/context/SidebarContext';
import AsistenciaButton from '@/components/AsistenciaButton';
import { DocumentosIcon, ActivityIcon, UsuarioIcon, RolIcon } from '@/components/icons';

const menuItems = [
  {
    name: 'Inicio',
    path: '/dashboard',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
  },
  {
    name: 'Facturas',
    path: '/dashboard/facturas',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  },
  {
    name: 'Proveedores',
    path: '/dashboard/proveedores',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  },

  {
    name: 'Pagos',
    path: '/dashboard/pagos',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  },
  {
    name: 'Facturas y sustentos',
    path: '/dashboard/documentos-mensuales',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
  },
  { name: 'Documentos de empresa', path: '/dashboard/documentos', icon: <DocumentosIcon/> },
  { name: 'Actividad', path: '/dashboard/actividad', icon: <ActivityIcon/> },
  { name: 'Usuarios', path: '/dashboard/usuarios', icon: <UsuarioIcon/> },
  { name: 'Roles y permisos', path: '/dashboard/roles', icon: <RolIcon/> },
  {
    name: 'Contadores',
    path: '/dashboard/contadores',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  },
  {
    name: 'Ajustes',
    path: '/dashboard/ajustes',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  },
];

export default function Sidebar({ user }: { user?: { email?: string; nombre_completo?: string; tipo_usuario?: string; permisos?: string[] } }) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();

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
        <div className={`flex items-center border-b border-white/10 ${isCollapsed ? 'h-16 justify-center px-2' : 'h-16 px-4'}`}>
          <div className={`flex items-center bg-white rounded-xl shadow-md ring-1 ring-white/40 ${isCollapsed ? 'p-1.5' : 'gap-2.5 px-3 py-2 w-full justify-center'}`}>
            <Image src="/logo-audivare.png" alt="Logo" width={28} height={28} className="object-contain flex-shrink-0" />
            {!isCollapsed && (
              <Image src="/titulo-audivare.png" alt="AudiVare" width={110} height={24} className="object-contain flex-shrink-0" />
            )}
          </div>
        </div>



        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {menuItems.filter(item => !['Facturas', 'Proveedores', 'Pagos'].includes(item.name)).map((item) => {
            const permisos = user?.permisos || [];
            const requerido: Record<string, string> = {
              'Usuarios': 'USUARIO_MANAGE', 'Roles y permisos': 'ROL_MANAGE',
              'Ajustes': 'USUARIO_MANAGE', 'Contadores': 'CONTADOR_INVITE',
              'Documentos de empresa': 'DOCUMENTO_EMPRESA_MANAGE',
              'Facturas y sustentos': 'DOCUMENTO_MENSUAL_READ', 'Actividad': 'DOCUMENTO_MENSUAL_READ'
            };
            if (requerido[item.name] && !permisos.includes(requerido[item.name])) return null;
            const targetPath = item.path;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.name}
                href={targetPath}
                title={isCollapsed ? item.name : undefined}
                onClick={() => isMobileOpen && closeMobileSidebar()}
                className={`flex items-center rounded-md transition-colors text-sm ${
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                } ${isActive
                  ? 'nav-active-neon font-semibold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {!isCollapsed && <span className="truncate">{item.name}</span>}
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
