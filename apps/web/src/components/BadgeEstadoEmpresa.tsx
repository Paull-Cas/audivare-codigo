// Badge reutilizable para el estado de suscripción de una empresa (panel superadmin).
//   ACTIVO → verde (#16A34A) | SUSPENDIDO → rojo | PENDIENTE → ámbar (aún no paga)

const ESTADOS: Record<string, { label: string; className: string }> = {
  ACTIVO: { label: 'ACTIVO', className: 'bg-green-100 text-[var(--color-accent)] ring-green-200/70' },
  SUSPENDIDO: { label: 'SUSPENDIDO', className: 'bg-red-100 text-red-700 ring-red-200/70' },
  PENDIENTE: { label: 'PENDIENTE', className: 'bg-amber-100 text-amber-700 ring-amber-200/70' },
};

export default function BadgeEstadoEmpresa({ estado }: { estado: string }) {
  const config = ESTADOS[estado] || { label: estado, className: 'bg-gray-100 text-gray-700 ring-gray-200/70' };

  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${config.className}`}>
      {config.label}
    </span>
  );
}
