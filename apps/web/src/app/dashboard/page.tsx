import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiUrl } from "@/config/api";
import { FacturaIcon, DocumentosIcon, UploadIcon, ArrowRightIcon, EyeIcon } from "@/components/icons";

export default async function Page() {
  const token = (await cookies()).get("token")?.value;
  if (!token) redirect("/login");
  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(`${getApiUrl()}/perfil/permisos`, { headers, cache: "no-store" });
  if (res.status === 401) redirect("/login");
  if (!res.ok) return <p>No se pudo consultar tu acceso. Intenta nuevamente.</p>;
  const { permisos }: { permisos: string[] } = await res.json();
  const puedeCargar = permisos.includes("DOCUMENTO_MENSUAL_CREATE");
  const puedeConsultar = permisos.includes("DOCUMENTO_MENSUAL_READ");
  let resumen: { facturas: number; sustentos: number; documentosEmpresa: number | null } | null = null;
  if (permisos.includes("DOCUMENTO_MENSUAL_READ")) {
    try {
      const respuesta = await fetch(`${getApiUrl()}/documentos-mensuales/resumen`, { headers, cache: "no-store" });
      if (respuesta.ok) resumen = await respuesta.json();
    } catch { /* Una falla no impide cargar documentos ni presenta cifras inventadas. */ }
  }
  return <section className="mx-auto max-w-5xl space-y-6">
    <header className="flex items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5 shadow-sm sm:p-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Tu espacio documental</p><h1 className="gradient-text text-3xl font-bold tracking-tight">Inicio</h1><p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">Los documentos de tu empresa, en un solo lugar.</p></div>
      <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white/80 text-blue-600 shadow-sm sm:flex"><DocumentosIcon className="h-8 w-8"/></span>
    </header>
    {(puedeCargar || puedeConsultar) && <div className={`grid gap-4 ${puedeCargar ? "sm:grid-cols-2" : ""} ${puedeCargar && puedeConsultar ? "xl:grid-cols-3" : ""}`}>
      {[
        ...(puedeCargar ? [
        { nombre: "Cargar factura", detalle: "Selecciona el mes y adjunta tu factura.", url: "/dashboard/cargar-factura", Icono: FacturaIcon, superficie: "border-violet-200 bg-gradient-to-br from-white to-violet-50 hover:border-violet-400 focus-visible:ring-violet-500", icono: "bg-violet-100 text-violet-700", titulo: "text-violet-950", texto: "text-slate-600", flecha: "bg-violet-100 text-violet-700" },
        { nombre: "Cargar sustento", detalle: "Medios de pago, guías y otros documentos.", url: "/dashboard/cargar-sustento", Icono: DocumentosIcon, superficie: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50 hover:border-emerald-400 focus-visible:ring-emerald-500", icono: "bg-emerald-100 text-emerald-700", titulo: "text-emerald-950", texto: "text-slate-600", flecha: "bg-emerald-100 text-emerald-700" },
        ] : []),
        ...(puedeConsultar ? [{ nombre: "Ver documentos", detalle: "Consulta tus facturas y sustentos.", url: "/dashboard/documentos-mensuales", Icono: EyeIcon, superficie: "border-blue-200 bg-gradient-to-br from-white to-blue-50 hover:border-blue-400 focus-visible:ring-blue-500", icono: "bg-blue-100 text-blue-700", titulo: "text-blue-950", texto: "text-slate-600", flecha: "bg-blue-100 text-blue-700" }] : []),
      ].map(({ nombre, detalle, url, Icono, superficie, icono, titulo, texto, flecha }) => <Link key={url} href={url} className={`group flex items-center gap-4 rounded-2xl border p-5 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${superficie}`}>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${icono}`}><Icono className="h-6 w-6"/></span>
        <span className="min-w-0 flex-1"><span className={`block text-base font-semibold ${titulo}`}>{nombre}</span><span className={`mt-1 block text-sm leading-relaxed ${texto}`}>{detalle}</span></span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${flecha}`}><ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5"/></span>
      </Link>)}
    </div>}
    {permisos.includes("DOCUMENTO_MENSUAL_READ") && <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-800">Tus documentos</h2><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">Todos los periodos</span></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { nombre: "Facturas", valor: resumen?.facturas, Icono: FacturaIcon, superficie: "border-blue-100 bg-gradient-to-br from-white to-blue-50", icono: "bg-blue-600 text-white", numero: "text-blue-950", franja: "bg-blue-500" },
          { nombre: "Sustentos", valor: resumen?.sustentos, Icono: UploadIcon, superficie: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50", icono: "bg-emerald-600 text-white", numero: "text-emerald-950", franja: "bg-emerald-500" },
          ...(permisos.includes("DOCUMENTO_EMPRESA_MANAGE") ? [{ nombre: "Documentos de empresa", valor: resumen?.documentosEmpresa, Icono: DocumentosIcon, superficie: "border-violet-100 bg-gradient-to-br from-white to-violet-50", icono: "bg-violet-600 text-white", numero: "text-violet-950", franja: "bg-violet-500" }] : []),
        ].map(({nombre, valor, Icono, superficie, icono, numero, franja}) => <div key={nombre} className={`relative flex items-center gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm ${superficie}`}>
          <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${franja}`}/>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${icono}`}><Icono className="h-5 w-5"/></span>
          <div><p className="text-sm font-medium text-slate-600">{nombre}</p><p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${numero}`}>{valor == null ? "—" : valor.toLocaleString("es-PE")}</p></div>
        </div>)}
      </div>
      {!resumen && <p role="status" className="mt-2 text-sm text-slate-500">No se pudieron consultar las estadísticas. Intenta recargar la página.</p>}
    </div>}
  </section>;
}
