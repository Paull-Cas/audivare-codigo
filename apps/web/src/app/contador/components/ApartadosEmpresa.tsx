"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocumentosIcon, DownloadIcon, EmpresaIcon, ActivityIcon } from "@/components/icons";

export default function ApartadosEmpresa({base}: {base: string}) {
  const pathname = usePathname();
  const apartados = [
    {nombre:"Facturas y sustentos",url:base,Icono:DocumentosIcon,tono:"border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100",activo:"border-blue-400 ring-blue-200"},
    {nombre:"Descargas",url:`${base}/descargas`,Icono:DownloadIcon,tono:"border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100",activo:"border-emerald-400 ring-emerald-200"},
    {nombre:"Documentos de empresa",url:`${base}/documentos`,Icono:EmpresaIcon,tono:"border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-400 hover:bg-violet-100",activo:"border-violet-400 ring-violet-200"},
    {nombre:"Actividad",url:`${base}/actividad`,Icono:ActivityIcon,tono:"border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100",activo:"border-amber-400 ring-amber-200"},
  ];
  return <nav aria-label="Apartados de la empresa" className="flex flex-wrap gap-3">
    {apartados.map(({nombre,url,Icono,tono,activo})=>{
      const seleccionado = url===base ? pathname===base || pathname.startsWith(`${base}/cargar-`) : pathname===url || pathname.startsWith(`${url}/`);
      return <Link key={url} href={url} aria-current={seleccionado ? "page" : undefined} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${tono} ${seleccionado ? `ring-2 ring-offset-2 ${activo}` : ""}`}><Icono className="h-5 w-5"/> {nombre}</Link>;
    })}
  </nav>;
}
