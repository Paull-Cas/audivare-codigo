import type { ReactNode } from 'react';

// Encabezado de página consistente: mosaico de icono con degradado + título + subtítulo + acciones.
export default function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  iconColor = 'text-[var(--color-primary)]',
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`${iconColor} flex-shrink-0 [&>svg]:w-7 [&>svg]:h-7`}>
          {icon}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
