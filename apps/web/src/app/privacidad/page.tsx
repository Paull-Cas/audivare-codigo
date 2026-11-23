'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { RESPONSABLE_AUDIVARE } from '@/config/legal';
import LegalLinks from '@/components/LegalLinks';
export default function Privacidad() {
  const [mensaje, setMensaje] = useState(''), [ocupado, setOcupado] = useState(false), [recibida, setRecibida] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, data = new FormData(form); setOcupado(true); setMensaje('');
    try {
      const res = await fetch('/api/privacidad/solicitudes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: data.get('tipo'), correo: data.get('correo'), descripcion: data.get('descripcion') }) });
      const result = await res.json();
      if (!res.ok) throw new Error(typeof result.message === 'string' ? result.message : 'No se recibió la solicitud');
      setRecibida(true); setMensaje(`Solicitud recibida. Guarda esta referencia: ${result.referencia}. Revisaremos tu identidad y el alcance antes de realizar acciones.`); form.reset();
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo enviar'); } finally { setOcupado(false); }
  }
  return <main className="max-w-xl mx-auto p-6 space-y-5">
    <h1 className="text-2xl font-semibold">Solicitudes sobre tus datos</h1>
    <address className="space-y-1 rounded border p-4 not-italic">
      <p>Responsable: {RESPONSABLE_AUDIVARE.nombre}</p>
      <p>{RESPONSABLE_AUDIVARE.domicilio}</p>
      <a className="break-all underline" href={`mailto:${RESPONSABLE_AUDIVARE.correo}`}>{RESPONSABLE_AUDIVARE.correo}</a>
    </address>
    <p>Puedes presentar una solicitud aunque no tengas acceso a tu cuenta. No adjuntes documentos, contraseñas, códigos de acceso ni datos de otras personas.</p>
    <p>Usaremos el correo y la descripción para recibir y atender tu solicitud. La recepción no autoriza automáticamente una entrega o eliminación de información. Este formulario no sustituye el Libro de Reclamaciones ni los documentos contractuales.</p>
    <form onSubmit={enviar} className="space-y-4">
      <label className="block">Tipo de solicitud<select name="tipo" required className="block border rounded p-2 w-full">
        {['ACCESO','RECTIFICACION','CANCELACION','OPOSICION','PORTABILIDAD','INFORMACION','ENTREGA'].map(t => <option key={t}>{t}</option>)}
      </select></label>
      <label className="block">Correo de contacto<input name="correo" type="email" required maxLength={254} className="block border rounded p-2 w-full" /></label>
      <label className="block">Describe lo que solicitas<textarea name="descripcion" required maxLength={2000} rows={5} className="block border rounded p-2 w-full" /></label>
      <button disabled={ocupado || recibida} className="rounded bg-emerald-700 text-white px-4 py-2 disabled:opacity-50">{ocupado ? 'Enviando…' : recibida ? 'Solicitud recibida' : 'Enviar solicitud'}</button>
    </form>
    <p role="status" className="break-words">{mensaje}</p><LegalLinks /><Link className="underline" href="/login">Volver al ingreso</Link>
  </main>;
}
