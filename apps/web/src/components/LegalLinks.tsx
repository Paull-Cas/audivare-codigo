import Link from 'next/link';
import { FacturaIcon, RolIcon, DocumentosIcon, ArrowRightIcon } from './icons';

export default function LegalLinks({ tarjetas = false }: {tarjetas?: boolean}) {
  if (tarjetas) return <nav data-nosnippet aria-label="Información legal y atención" className="grid gap-3 sm:grid-cols-3">
    {[
      {nombre:'Términos de uso',href:'/terminos',Icono:FacturaIcon,tono:'border-violet-200 bg-violet-50/60 text-violet-950 hover:border-violet-400',icono:'bg-violet-100 text-violet-700'},
      {nombre:'Política de privacidad',href:'/politica-privacidad',Icono:RolIcon,tono:'border-emerald-200 bg-emerald-50/60 text-emerald-950 hover:border-emerald-400',icono:'bg-emerald-100 text-emerald-700'},
      {nombre:'Solicitudes sobre datos',href:'/privacidad',Icono:DocumentosIcon,tono:'border-blue-200 bg-blue-50/60 text-blue-950 hover:border-blue-400',icono:'bg-blue-100 text-blue-700'},
    ].map(({nombre,href,Icono,tono,icono})=><Link key={href} href={href} className={`group flex items-center gap-3 rounded-xl border p-4 text-sm font-medium shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${tono}`}><span className={`rounded-lg p-2 ${icono}`}><Icono className="h-5 w-5"/></span><span className="flex-1">{nombre}</span><ArrowRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"/></Link>)}
  </nav>;
  return (
    <nav data-nosnippet aria-label="Información legal y atención" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-600">
      <Link className="underline" href="/terminos">Términos de uso</Link>
      <Link className="underline" href="/politica-privacidad">Política de privacidad</Link>
      <Link className="underline" href="/privacidad">Solicitudes sobre datos</Link>
    </nav>
  );
}
