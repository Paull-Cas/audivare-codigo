// Badge reutilizable para el estado de pago de una factura.
//   ACTIVA → azul (#2563EB)   | PAGADA → verde (#16A34A)

const ESTADOS: Record<string, { label: string; className: string }> = {
  ACTIVA: { label: 'Activa', className: 'bg-blue-100 text-[var(--color-primary)] ring-blue-200/70' },
  PAGADA: { label: 'Pagada', className: 'bg-green-100 text-[var(--color-accent)] ring-green-200/70' },
};

export default function BadgeEstadoFactura({
  estado,
  size = 'sm',
}: {
  estado: string;
  size?: 'sm' | 'md';
}) {
  const config = ESTADOS[estado] || { label: estado, className: 'bg-gray-100 text-gray-700 ring-gray-200/70' };
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-block ${sizeClass} font-semibold rounded-full ring-1 ring-inset ${config.className}`}>
      {config.label}
    </span>
  );
}
