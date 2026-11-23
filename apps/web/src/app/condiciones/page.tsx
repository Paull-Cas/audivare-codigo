'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import ConsentimientoLegal from '@/components/ConsentimientoLegal';
import LegalLinks from '@/components/LegalLinks';
import { TERMINOS_AUDIVARE } from '@/config/legal';
import { FacturaIcon, CheckIcon, ActivityIcon, ArrowRightIcon } from '@/components/icons';

export default function CondicionesPage() {
  const [fecha, setFecha] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function consultar() {
      try {
        const res = await fetch('/api/legal/aceptacion', { signal: controller.signal });
        if (!res.ok) throw new Error('No se pudo consultar el registro. Puedes reintentar al guardar.');
        const data = await res.json(); setFecha(data.aceptada_en ?? null);
      } catch (error) {
        if (!controller.signal.aborted) setMensaje(error instanceof Error ? error.message : 'No se pudo consultar');
      } finally { if (!controller.signal.aborted) setCargando(false); }
    }
    void consultar(); return () => controller.abort();
  }, []);
  async function aceptar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setGuardando(true); setMensaje('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/legal/aceptacion', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acepta_terminos: form.get('acepta_terminos') === 'on',
          privacidad_leida: form.get('privacidad_leida') === 'on', version_legal: TERMINOS_AUDIVARE.version }) });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'No se pudo guardar la aceptación');
      setFecha(data.aceptada_en); setMensaje('La aceptación quedó registrada para tu cuenta.');
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }
  return <div className="app-surface min-h-screen"><main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-slate-800 sm:px-6 sm:py-10">
    <Link className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" href="/dashboard"><ArrowRightIcon className="h-4 w-4 rotate-180"/> Volver a la aplicación</Link>
    <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-7"><span className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800"><FacturaIcon className="h-4 w-4"/> Tu cuenta · AudiVare</span><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Revisión de condiciones</h1><p className="mt-3 text-sm font-medium text-blue-700">Versión {TERMINOS_AUDIVARE.version}</p></header>
    <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600 shadow-sm">Revisa los términos y la política de privacidad. Esta acción corresponde a tu cuenta personal; no autoriza cambios de precio ni reduce periodos ya pagados. Los acuerdos de la empresa se coordinan con su representante.</p>
    <LegalLinks tarjetas />
    {cargando ? <p role="status" className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800"><ActivityIcon/> Consultando registro…</p> : fecha ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><CheckIcon className="h-5 w-5"/></span><div><h2 className="font-semibold">Aceptación registrada</h2><p className="mt-1 text-sm leading-relaxed">Versión {TERMINOS_AUDIVARE.version} registrada el {new Date(fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (hora de Perú).</p></div></div> :
      <form onSubmit={aceptar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><ConsentimientoLegal />
        <button disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"><CheckIcon className="h-5 w-5"/>{guardando ? 'Guardando…' : 'Registrar aceptación'}</button>
      </form>}
    {mensaje && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-800">{mensaje}</p>}
  </main></div>;
}
