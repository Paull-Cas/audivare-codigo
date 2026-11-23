'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FileInputES from './FileInputES';
import { entradaFactura, patronFactura } from './factura-entrada';

export interface FacturaEditable {
  id?: string; tipoComprobante?: string; serie?: string; numero?: string; proveedorRuc?: string;
  proveedorNombre?: string; fechaEmision?: string; moneda?: string; montoTotal?: string;
  baseImponible?: string | null; igv?: string | null; fechaActualizacion?: string;
}

const nombres: Record<string, string> = { serie: 'Serie', numero: 'Número', fechaEmision: 'Fecha de emisión',
  proveedorRuc: 'RUC del proveedor', proveedorNombre: 'Nombre o razón social del proveedor', montoTotal: 'Importe total' };
const fechaHoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function FacturaFormulario({ inicial, path = '/facturas', detalleBase = '/dashboard/facturas',
  documentosBase = '/api/facturas', puedeSubir = true }: {
  inicial?: FacturaEditable; path?: string; detalleBase?: string; documentosBase?: string; puedeSubir?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [existente, setExistente] = useState<string>();
  const [archivo, setArchivo] = useState<File | null>(null), [creada, setCreada] = useState<string>();
  const [datos, setDatos] = useState<FacturaEditable>({ tipoComprobante: '01', moneda: 'PEN', fechaEmision: fechaHoy(), ...inicial });
  const editar = Boolean(inicial?.id);
  // El alta manual es de facturas. Al editar se conserva el tipo importado.
  const campos = { ...nombres, ...(inicial?.baseImponible != null || inicial?.igv != null
    ? { baseImponible: 'Base imponible ya registrada (opcional)', igv: 'IGV ya registrado (opcional)' } : {}) };

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setExistente(undefined); setBusy(true);
    let id = creada;
    try {
      if (!id) {
        const res = await fetch('/api/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: editar ? `${path}/${inicial!.id}` : path, method: editar ? 'PATCH' : 'POST', body: datos }) });
        const respuesta = await res.json();
        if (!res.ok) {
          setExistente(respuesta.facturaId);
          throw new Error(Array.isArray(respuesta.message) ? respuesta.message.join('. ') : respuesta.message || 'No se pudo guardar');
        }
        id = respuesta.id; setCreada(id);
      }
      if (archivo && !editar) {
        const fd = new FormData(); fd.append('file', archivo); fd.append('tipo_documento', 'OTROS'); fd.append('descripcion', 'Factura original');
        const res = await fetch(`${documentosBase}/${id}/documentos`, { method: 'POST', body: fd });
        if (!res.ok) {
          const respuesta = await res.json().catch(() => ({}));
          throw new Error(`La factura ya se guardó, pero el archivo no se cargó. ${respuesta.message || 'Inténtalo de nuevo o continúa en la documentación.'}`);
        }
      }
      setOpen(false);
      if (editar) window.location.reload();
      else router.push(`${detalleBase}/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red. Revisa si la factura se guardó antes de repetir.'); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="btn-primary px-4 py-2 rounded-md text-white text-sm" onClick={() => {
      setDatos({ tipoComprobante: '01', moneda: 'PEN', fechaEmision: fechaHoy(), ...inicial }); setArchivo(null); setError(''); setExistente(undefined); setCreada(undefined); setOpen(true);
    }}>{editar ? 'Editar factura' : 'Agregar factura'}</button>
    {open && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="factura-form-titulo" className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h2 id="factura-form-titulo" className="text-xl font-semibold">{editar ? 'Editar datos de la factura' : 'Agregar factura individual'}</h2>
        <p className="text-sm text-gray-500 my-3">{editar ? 'Los cambios quedarán en el historial con su autor. Esta edición no modifica el comprobante emitido ni SUNAT.' : 'Registra la factura con los mismos datos principales del archivo de SUNAT. Después añade sus documentos y pagos.'} Serie y número son obligatorios.</p>
        {editar && inicial?.tipoComprobante && inicial.tipoComprobante !== '01' && <p className="text-sm text-gray-600 mb-3">Tipo del comprobante importado: {inicial.tipoComprobante}. Se conserva al editar.</p>}
        <form onSubmit={guardar} className="space-y-4">
          <fieldset disabled={busy || Boolean(creada)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(campos).map(([campo, label]) => <label key={campo} className="text-sm">{label}
              <input required={!['baseImponible', 'igv'].includes(campo)} type={campo === 'fechaEmision' ? 'date' : 'text'}
                inputMode={['montoTotal', 'baseImponible', 'igv'].includes(campo) ? 'decimal' : ['numero', 'proveedorRuc'].includes(campo) ? 'numeric' : 'text'}
                pattern={patronFactura(campo)}
                maxLength={campo === 'proveedorNombre' ? 255 : campo === 'proveedorRuc' ? 11 : 20}
                value={datos[campo as keyof FacturaEditable] ?? ''} onChange={e => {
                  const valor = entradaFactura(campo, e.target.value);
                  if (valor !== null) setDatos({ ...datos, [campo]: valor });
                }} className="block border rounded-md w-full p-2" />
            </label>)}
            <label className="text-sm">Moneda<select value={datos.moneda} onChange={e => setDatos({ ...datos, moneda: e.target.value })} className="block border rounded-md w-full p-2"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></label>
          </fieldset>
          {!editar && puedeSubir && <label className="block text-sm">Foto o PDF del comprobante (opcional, máximo 10 MB)
            <FileInputES disabled={busy} accept="application/pdf,image/png,image/jpeg" onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
          </label>}
          {error && <p role="alert" className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</p>}
          {(creada || existente) && <Link className="block text-blue-700 underline" href={`${detalleBase}/${creada || existente}`}>Abrir la factura guardada y su documentación</Link>}
          <div className="flex gap-3 justify-end"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-4 py-2 border rounded-md">Cerrar</button>
            <button disabled={busy} className="btn-primary px-4 py-2 rounded-md text-white">{busy ? 'Guardando…' : creada ? 'Reintentar archivo y continuar' : editar ? 'Guardar cambios' : 'Guardar y añadir documentación'}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
