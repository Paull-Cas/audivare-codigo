// Badge reutilizable para el estado de una observación.
//   Pendiente → rojo | Atendida → verde (#16A34A)

export default function BadgeObservacion({ atendida }: { atendida: boolean }) {
  return atendida ? (
    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full ring-1 ring-inset ring-green-200/70 bg-green-100 text-[var(--color-accent)]">
      Atendida
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full ring-1 ring-inset ring-red-200/70 bg-red-100 text-red-700">
      Pendiente
    </span>
  );
}
