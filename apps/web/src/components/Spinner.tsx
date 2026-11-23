// Spinner de carga consistente para toda la app.

export default function Spinner({
  label,
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-gray-500 ${className}`}>
      <svg
        className="w-8 h-8 animate-spin text-[var(--color-primary)]"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}
