'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
type Expediente = { id: string; tipo: string; correo: string | null; descripcion: string; estado: string; creadaEn: string; plazoEn: string | null };
type Evento = { id: string; estado: string; nota: string; fecha: string };
type Detalle = Expediente & { eventos: Evento[] };
type Auditoria = { id: string; ruta: string; metodo: string; estado: string; codigoHttp: number | null; iniciadaEn: string; actorId: string | null; recursos: Record<string,string> };
async function llamar(path: string, method = 'GET', body?: unknown) {
  const res = await fetch('/api/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, method, ...(body ? { body } : {}) }) });
  const data = await res.json(); if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'No se pudo completar'); return data;
}
export default function GestionPrivacidad() {
  const [lista, setLista] = useState<Expediente[]>([]), [detalle, setDetalle] = useState<Detalle | null>(null);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]), [error, setError] = useState(''), [ocupado, setOcupado] = useState(false);
  const seleccion = useRef(0);
  async function cargar(antes?: string) { setLista(await llamar(`/superadmin/privacidad/solicitudes${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`)); }
  useEffect(() => { cargar().catch(e => setError(e.message)); }, []);
  async function seleccionar(id: string) { const turno=++seleccion.current; try { setError(''); const datos=await llamar(`/superadmin/privacidad/solicitudes/${id}`); if(turno===seleccion.current)setDetalle(datos); } catch(e) { if(turno===seleccion.current)setError(e instanceof Error ? e.message : 'Error'); } }
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!detalle) return; const form=e.currentTarget, f=new FormData(form); setOcupado(true); setError('');
    try { const plazo=f.get('plazo'); await llamar(`/superadmin/privacidad/solicitudes/${detalle.id}`, 'PATCH', {
      estado:f.get('estado'), nota:f.get('nota'), ...(plazo ? { plazo_en:new Date(String(plazo)).toISOString() } : {}) });
      form.reset(); await seleccionar(detalle.id); await cargar();
    } catch(e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setOcupado(false); }
  }
  async function verAuditoria(antes?: string) { try { setError(''); setAuditoria(await llamar(`/superadmin/privacidad/auditoria${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`)); } catch(e) { setError(e instanceof Error ? e.message : 'Error'); } }
  async function abrirIncidente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget, f=new FormData(form); setOcupado(true); setError('');
    try { const r=await llamar('/superadmin/privacidad/incidentes','POST',{descripcion:f.get('descripcion')}); form.reset(); await cargar(); await seleccionar(r.id); }
    catch(e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setOcupado(false); }
  }
  return <section className="space-y-5"><h1 className="text-2xl font-semibold">Privacidad y actividad</h1>
    <p>Gestión reservada al administrador principal. Verifica identidad y representación antes de entregar información. Registrar una respuesta no envía correo ni elimina documentos.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <details className="border rounded p-3"><summary>Registrar incidente de seguridad</summary><form onSubmit={abrirIncidente} className="space-y-3 mt-3">
      <p>Incluye la hora de conocimiento y los hechos disponibles. Este registro no envía avisos a clientes ni autoridades; debes realizar y documentar esas comunicaciones.</p>
      <textarea name="descripcion" required maxLength={2000} aria-label="Hechos del incidente" className="border rounded p-2 w-full" />
      <button disabled={ocupado} className="bg-emerald-700 text-white rounded p-2">Abrir expediente</button>
    </form></details>
    <h2 className="font-semibold">Últimas 100 solicitudes</h2>
    {lista.map(r => <button disabled={ocupado} className="block border rounded p-3 w-full text-left" key={r.id} onClick={() => seleccionar(r.id)}>{r.tipo} — {r.estado} — {r.correo}<span className="block text-sm">{new Date(r.creadaEn).toLocaleString('es-PE', { timeZone:'America/Lima' })}{r.plazoEn ? ` · Plazo: ${new Date(r.plazoEn).toLocaleString('es-PE', { timeZone:'America/Lima' })}` : ' · Plazo sin asignar'}</span></button>)}
    {lista.length===100 && <button className="underline" onClick={() => cargar(`${lista[lista.length-1].creadaEn}|${lista[lista.length-1].id}`).catch(e => setError(e.message))}>Solicitudes anteriores</button>}
    {detalle && <div className="border rounded p-4 space-y-3"><h2 className="font-semibold">Solicitud {detalle.id}</h2><p className="whitespace-pre-wrap break-words">{detalle.descripcion}</p>
      {detalle.eventos.map(e => <p key={e.id} className="whitespace-pre-wrap">{e.estado}: {e.nota}</p>)}
      {detalle.estado !== 'RESPONDIDA' && <form key={`${detalle.id}:${detalle.eventos.length}`} onSubmit={guardar} className="space-y-3">
        <label className="block">Estado<select name="estado" defaultValue={detalle.estado} className="block border rounded p-2">{['RECIBIDA','VERIFICADA','DERIVADA','RESPONDIDA'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="block">Plazo de atención, según cómputo aplicable<input type="datetime-local" name="plazo" className="block border rounded p-2" /></label>
        <label className="block">Nota y constancia de actuación<textarea name="nota" required maxLength={2000} className="block border rounded p-2 w-full" /></label>
        <button disabled={ocupado} className="bg-emerald-700 text-white rounded p-2">Guardar actuación</button>
      </form>}
    </div>}
    <h2 className="font-semibold">Actividad del sistema</h2><button className="underline" onClick={() => verAuditoria()}>Consultar últimos 100 registros</button>
    {auditoria.map(a => <div className="border rounded p-2 text-sm break-words" key={a.id}>{new Date(a.iniciadaEn).toLocaleString('es-PE',{timeZone:'America/Lima'})} · {a.metodo} {a.ruta} · {a.estado === 'PENDIENTE' ? 'Resultado pendiente' : a.codigoHttp ?? 'Cambio registrado'} · {a.actorId ?? 'Sin actor autenticado'}<p>{JSON.stringify(a.recursos)}</p></div>)}
    {auditoria.length===100 && <button className="underline" onClick={() => verAuditoria(`${auditoria[auditoria.length-1].iniciadaEn}|${auditoria[auditoria.length-1].id}`)}>Consultar registros anteriores</button>}
  </section>;
}
