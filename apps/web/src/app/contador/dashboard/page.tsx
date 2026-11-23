import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { DocumentosIcon, SearchIcon } from '@/components/icons';
import PendingInvitations from './components/PendingInvitations';
import PrimerosPasosContador from './components/PrimerosPasosContador';

interface EmpresaContador { id: string; razon_social: string | null; ruc: string | null; fecha_vinculacion: string }
interface ResultadoEmpresas { data: EmpresaContador[]; total: number; pagina: number; porPagina: number }
const boton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const secundario = 'inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
function urlPagina(pagina: number, busqueda: string) {
  const q = new URLSearchParams({ pagina: String(pagina) });
  if (busqueda) q.set('busqueda', busqueda);
  return `/contador/dashboard?${q}`;
}
export default async function ContadorDashboardPage({ searchParams }: {
  searchParams: Promise<{busqueda?: string | string[]; pagina?: string | string[]}>;
}) {
  const token = (await cookies()).get('token')?.value;
  if (!token) return notFound();
  const consulta = await searchParams;
  const busqueda = typeof consulta.busqueda === 'string' ? consulta.busqueda.trim() : '';
  const q = new URLSearchParams();
  if (busqueda) q.set('busqueda', busqueda);
  if (typeof consulta.pagina === 'string') q.set('pagina', consulta.pagina);
  let name = 'Contador';
  try { const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); name = payload.nombre_completo || payload.email?.split('@')[0] || name; } catch { /* Nombre opcional. */ }
  let resultado: ResultadoEmpresas | null = null;
  let error = '';
  try {
    const res = await fetch(`${getApiUrl()}/contador/empresas?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) {
      const dato: {message?: unknown} = await res.json().catch(() => ({}));
      error = typeof dato.message === 'string' ? dato.message : 'No se pudieron consultar las empresas. Intenta nuevamente.';
    } else resultado = await res.json() as ResultadoEmpresas;
  } catch { error = 'No se pudo conectar. Intenta nuevamente.'; }
  const total = resultado?.total ?? 0;
  const pagina = resultado?.pagina ?? 1;
  const totalPaginas = Math.max(1, Math.ceil(total / 10));
  if (resultado && pagina > totalPaginas) redirect(urlPagina(totalPaginas, busqueda));
  const paginas = [...new Set([1, pagina - 1, pagina, pagina + 1, totalPaginas])].filter(p => p >= 1 && p <= totalPaginas).sort((a,b) => a-b);
  const paginaBoton = 'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <PendingInvitations/>
    <header><h1 className="text-2xl font-semibold text-slate-900">Bienvenido, {name}</h1><p className="mt-2 text-slate-600">Busca una empresa vinculada para gestionar sus facturas y sustentos.</p></header>
    {!busqueda && resultado && <PrimerosPasosContador tieneEmpresas={total > 0}/>}
    <form action="/contador/dashboard" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Buscar empresa por RUC o razón social<input type="search" name="busqueda" defaultValue={busqueda} maxLength={200} placeholder="RUC o nombre de la empresa" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900"/></label>
      <button className={boton}><SearchIcon/> Buscar</button>
      {busqueda && <Link href="/contador/dashboard" className={secundario}>Limpiar búsqueda</Link>}
    </form>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Empresas vinculadas al contador</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4" scope="col">Razón social</th><th className="px-5 py-4" scope="col">RUC</th><th className="px-5 py-4 text-right" scope="col">Acciones</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{resultado?.data.length ? resultado.data.map(e => <tr key={e.id} className="hover:bg-blue-50/30">
          <td className="max-w-sm break-words px-5 py-4 font-medium text-slate-800">{e.razon_social || 'Empresa sin razón social'}</td><td className="px-5 py-4 text-slate-600">{e.ruc || 'Sin RUC'}</td>
          <td className="px-5 py-4 text-right"><Link className={boton} href={`/contador/empresa/${e.id}`}><DocumentosIcon/> Abrir</Link></td>
        </tr>) : <tr><td colSpan={3} className="px-5 py-12 text-center text-slate-500">{busqueda ? 'No hay empresas que coincidan con la búsqueda.' : 'No tienes empresas con acceso vigente vinculadas.'}</td></tr>}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4">
        <p className="text-sm text-slate-500">{total ? `Mostrando ${(pagina-1)*10+1} a ${Math.min(pagina*10,total)} de ${total} empresas` : '0 empresas'}</p>
        <nav aria-label="Paginación de empresas" className="flex flex-wrap gap-1.5">
          {pagina > 1 && <Link className={paginaBoton} aria-label="Página anterior" href={urlPagina(pagina-1,busqueda)}>‹</Link>}
          {paginas.map((p,i) => <span key={p} className="inline-flex items-center gap-1.5">{i > 0 && p > paginas[i-1]+1 && <span className="text-slate-400">…</span>}<Link href={urlPagina(p,busqueda)} aria-label={`Página ${p}`} aria-current={p===pagina ? 'page' : undefined} className={`${paginaBoton} ${p===pagina ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : ''}`}>{p}</Link></span>)}
          {pagina < totalPaginas && <Link className={paginaBoton} aria-label="Página siguiente" href={urlPagina(pagina+1,busqueda)}>›</Link>}
        </nav>
      </div>
    </div>}
  </div>;
}
