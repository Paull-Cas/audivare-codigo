import Link from 'next/link';

/**
 * Paginación numerada con ventana y elipsis. Muestra siempre la primera y la
 * última página, más las vecinas de la actual; el resto se colapsa en "…".
 * Es un Server Component: solo renderiza enlaces que preservan los filtros
 * actuales (searchParams) cambiando el parámetro `page`.
 */
function construirPaginas(actual: number, totalPaginas: number, vecinas = 1): (number | '...')[] {
  const paginas: (number | '...')[] = [];
  for (let p = 1; p <= totalPaginas; p++) {
    const esBorde = p === 1 || p === totalPaginas;
    const esCercana = p >= actual - vecinas && p <= actual + vecinas;
    if (esBorde || esCercana) {
      paginas.push(p);
    } else if (paginas[paginas.length - 1] !== '...') {
      paginas.push('...');
    }
  }
  return paginas;
}

export default function Pagination({
  page,
  limit,
  total,
  basePath,
  searchParams,
  etiqueta = 'resultados',
}: {
  page: number;
  limit: number;
  total: number;
  basePath: string;
  searchParams: { [key: string]: string | undefined };
  etiqueta?: string;
}) {
  if (total <= 0) return null;

  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  const actual = Math.min(Math.max(1, page), totalPaginas);

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== '' && k !== 'page') params.set(k, v);
    }
    params.set('page', String(p));
    return `${basePath}?${params.toString()}`;
  };

  const desde = (actual - 1) * limit + 1;
  const hasta = Math.min(actual * limit, total);
  const paginas = construirPaginas(actual, totalPaginas);

  const btnBase =
    'inline-flex items-center justify-center min-w-[2.25rem] h-9 px-3 rounded-md text-sm font-medium transition-colors shadow-sm';

  return (
    <div className="px-6 py-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/30">
      <span className="text-sm text-gray-500">
        Mostrando {desde} a {hasta} de {total} {etiqueta}
      </span>

      {totalPaginas > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Paginación">
          {actual > 1 ? (
            <Link href={hrefPagina(actual - 1)} className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`} aria-label="Página anterior">
              ‹
            </Link>
          ) : (
            <span className={`${btnBase} border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed`} aria-hidden="true">‹</span>
          )}

          {paginas.map((p, idx) =>
            p === '...' ? (
              <span key={`gap-${idx}`} className="px-1.5 text-sm text-gray-400 select-none">…</span>
            ) : p === actual ? (
              <span key={p} aria-current="page" className={`${btnBase} btn-primary text-white`}>
                {p}
              </span>
            ) : (
              <Link key={p} href={hrefPagina(p)} className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
                {p}
              </Link>
            )
          )}

          {actual < totalPaginas ? (
            <Link href={hrefPagina(actual + 1)} className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`} aria-label="Página siguiente">
              ›
            </Link>
          ) : (
            <span className={`${btnBase} border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed`} aria-hidden="true">›</span>
          )}
        </nav>
      )}
    </div>
  );
}
