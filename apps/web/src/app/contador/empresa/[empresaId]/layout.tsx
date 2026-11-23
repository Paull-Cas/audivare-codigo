import Link from "next/link";
import { cookies } from "next/headers";
import { getApiUrl } from "@/config/api";
import { EmpresaIcon, ArrowRightIcon } from "@/components/icons";
import ApartadosEmpresa from "../../components/ApartadosEmpresa";
export default async function Layout({children, params}: {children: React.ReactNode; params: Promise<{empresaId: string}>}) {
  const {empresaId} = await params;
  const base = `/contador/empresa/${empresaId}`;
  const token = (await cookies()).get("token")?.value;
  let empresa: { razon_social: string | null; ruc: string | null } | null = null;
  try {
    if (token) {
      const res = await fetch(`${getApiUrl()}/contador/empresas/${encodeURIComponent(empresaId)}`, {headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      if (res.ok) empresa = await res.json();
    }
  } catch { /* No mostrar formularios si no se pudo verificar la empresa. */ }
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <Link href="/contador/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ArrowRightIcon className="h-4 w-4 rotate-180"/> Empresas vinculadas</Link>
    {empresa ? <>
    <header className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-white to-blue-50 p-5 shadow-sm"><span className="shrink-0 rounded-xl bg-blue-100 p-3 text-blue-700"><EmpresaIcon className="h-6 w-6"/></span><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-slate-900">{empresa.razon_social || "Empresa sin razón social"}</h2><p className="mt-1 text-sm text-slate-600">RUC: {empresa.ruc || "Sin RUC"}</p></div></header>
    <ApartadosEmpresa base={base}/>
    {children}
    </> : <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">No se pudo acceder a esta empresa. Comprueba el vínculo y su vigencia o intenta nuevamente.</p>}
  </div>;
}
