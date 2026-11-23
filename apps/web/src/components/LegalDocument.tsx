import Link from 'next/link';
import { RESPONSABLE_AUDIVARE, type DocumentoLegal } from '@/config/legal';
import LegalLinks from './LegalLinks';
import { ArrowRightIcon, ActivityIcon, UsuarioIcon, FacturaIcon } from './icons';

export default function LegalDocument({ documento }: { documento: DocumentoLegal }) {
  return (
    <div className="app-surface min-h-screen text-slate-800"><main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-bold tracking-tight text-blue-700">AudiVare</Link><Link className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" href="/login"><ArrowRightIcon className="h-4 w-4 rotate-180"/> Volver al ingreso</Link></div>
      <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-8">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800"><FacturaIcon className="h-4 w-4"/> Información legal</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">{documento.titulo}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full border border-blue-200 bg-white px-3 py-1 font-medium text-blue-700">Versión {documento.version}</span><span className="inline-flex items-center gap-2 px-2 py-1 text-slate-600"><ActivityIcon className="h-4 w-4"/> {documento.fecha}</span></div>
      </header>
      <address className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 not-italic shadow-sm sm:p-6">
        <span className="shrink-0 rounded-xl bg-violet-100 p-2.5 text-violet-700"><UsuarioIcon className="h-5 w-5"/></span>
        <div className="min-w-0 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable del servicio</p><p className="font-semibold text-slate-900">{RESPONSABLE_AUDIVARE.nombre}</p>
        <p className="text-sm leading-relaxed text-slate-600">{RESPONSABLE_AUDIVARE.domicilio}</p>
        <p><a className="break-all text-sm font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-600" href={`mailto:${RESPONSABLE_AUDIVARE.correo}`}>{RESPONSABLE_AUDIVARE.correo}</a></p></div>
      </address>
      <details className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-semibold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Contenido del documento</summary><nav aria-label="Contenido del documento" className="mt-4"><ol className="grid gap-2 sm:grid-cols-2">{documento.secciones.map((seccion,i)=><li key={seccion.titulo}><a className="block rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" href={`#seccion-${i+1}`}>{seccion.titulo}</a></li>)}</ol></nav></details>
      {documento.secciones.map((seccion,i) => (
        <section id={`seccion-${i+1}`} key={seccion.titulo} className="scroll-mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="flex items-start gap-3 text-lg font-semibold leading-snug text-slate-900 sm:text-xl"><span aria-hidden="true" className="mt-0.5 h-6 w-1 shrink-0 rounded-full bg-blue-500"/>{seccion.titulo}</h2>
          {seccion.parrafos.map(parrafo => <p key={parrafo} className="break-words text-sm leading-7 text-slate-700 sm:text-base sm:leading-7">{parrafo}</p>)}
        </section>
      ))}
      <footer className="space-y-4 pt-3"><p className="text-sm font-semibold text-slate-600">Más información y atención</p><LegalLinks tarjetas /></footer>
    </main></div>
  );
}
