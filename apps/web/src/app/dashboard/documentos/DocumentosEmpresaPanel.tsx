'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DocumentoEmpresaViewer from '@/components/DocumentoEmpresaViewer';
import FileInputES from '@/components/FileInputES';
import AyudaTip from '@/components/AyudaTip';

interface DocEmpresa {
  id: string;
  titulo: string;
  descripcion: string | null;
  anio: number | null;
  mes: number | null;
  archivoNombreOriginal: string;
  fechaSubida: string;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function periodoTexto(anio: number | null, mes: number | null): string {
  if (!anio) return '—';
  if (mes && mes >= 1 && mes <= 12) return `${MESES[mes - 1]} ${anio}`;
  return String(anio);
}

export default function DocumentosEmpresaPanel({ documentos }: { documentos: DocEmpresa[] }) {
  const router = useRouter();
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 8 }, (_, i) => anioActual - i);

  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; doc?: DocEmpresa } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocEmpresa | null>(null);
  const [reemplazandoId, setReemplazandoId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const abrirCrear = () => { setError(null); setModal({ modo: 'crear' }); };
  const abrirEditar = (doc: DocEmpresa) => { setError(null); setModal({ modo: 'editar', doc }); };

  const guardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const titulo = (fd.get('titulo') as string)?.trim();
    if (!titulo) { setError('El título es obligatorio'); return; }
    setLoading(true);
    setError(null);
    try {
      if (modal.modo === 'crear') {
        if (!(fd.get('file') as File)?.size) { setError('Debes adjuntar un archivo'); setLoading(false); return; }
        const res = await fetch('/api/documentos-empresa', { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || 'Error al subir'); setLoading(false); return; }
      } else {
        // Solo datos (título/descripción/periodo) vía JSON.
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `/documentos-empresa/${modal.doc!.id}`,
            method: 'PATCH',
            body: {
              titulo,
              descripcion: (fd.get('descripcion') as string) || null,
              anio: fd.get('anio') ? Number(fd.get('anio')) : null,
              mes: fd.get('mes') ? Number(fd.get('mes')) : null,
            },
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || 'Error al guardar'); setLoading(false); return; }
      }
      setModal(null);
      router.refresh();
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  const reemplazarArchivo = async (docId: string, file: File) => {
    setReemplazandoId(docId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/documentos-empresa/${docId}/archivo`, { method: 'PATCH', body: fd });
      if (res.ok) router.refresh();
      else { const d = await res.json().catch(() => ({})); alert(d.message || 'Error al reemplazar el archivo'); }
    } catch {
      alert('Error de red al reemplazar el archivo');
    } finally {
      setReemplazandoId(null);
    }
  };

  const eliminar = async () => {
    if (!deleting) return;
    setLoading(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/documentos-empresa/${deleting.id}`, method: 'DELETE' }),
      });
      if (res.ok) { setDeleting(null); router.refresh(); }
      else { const d = await res.json().catch(() => ({})); alert(d.message || 'Error al eliminar'); }
    } catch {
      alert('Error de red al eliminar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-end items-center gap-2">
        <AyudaTip titulo="Documentos de la empresa" texto="Repositorio de documentación financiera que tu contador necesita: cronograma de préstamos, estados de cuenta bancario, contratos Leasing, etc. No están ligados a una factura. Ponle un título claro y, si aplica, el año/mes. El contador puede verlos y descargarlos." />
        <button onClick={abrirCrear} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Subir documento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-gray-50/60 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Periodo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Archivo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subido</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {documentos.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">Aún no hay documentos cargados</td></tr>
              ) : (
                documentos.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--color-text)]">{d.titulo}</div>
                      {d.descripcion && <div className="text-xs text-gray-500 mt-0.5 max-w-md">{d.descripcion}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{periodoTexto(d.anio, d.mes)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate" title={d.archivoNombreOriginal}>{d.archivoNombreOriginal}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(d.fechaSubida).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DocumentoEmpresaViewer descargarPath={`/documentos-empresa/${d.id}/descargar`} nombreArchivo={d.archivoNombreOriginal} />
                        <button onClick={() => abrirEditar(d)} title="Editar datos" aria-label="Editar datos" className="inline-flex items-center justify-center p-1.5 rounded text-[var(--color-primary)] bg-blue-50 hover:bg-blue-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => fileInputs.current[d.id]?.click()} disabled={reemplazandoId === d.id} title="Reemplazar archivo" aria-label="Reemplazar archivo" className="inline-flex items-center justify-center p-1.5 rounded text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          ref={(el) => { fileInputs.current[d.id] = el; }}
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) reemplazarArchivo(d.id, f); e.target.value = ''; }}
                        />
                        <button onClick={() => setDeleting(d)} title="Eliminar" aria-label="Eliminar" className="inline-flex items-center justify-center p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">{modal.modo === 'crear' ? 'Subir documento' : 'Editar documento'}</h2>
              <button onClick={() => !loading && setModal(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título <span className="text-red-500">*</span></label>
                <input name="titulo" required defaultValue={modal.doc?.titulo} placeholder="Ej. cronograma de préstamos, estados de cuenta bancario, contratos Leasing" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción (opcional)</label>
                <textarea name="descripcion" defaultValue={modal.doc?.descripcion ?? ''} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] min-h-[60px]" placeholder="Detalle adicional (entidad, número de operación, etc.)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Año (opcional)</label>
                  <select name="anio" defaultValue={modal.doc?.anio ?? ''} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]">
                    <option value="">—</option>
                    {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mes (opcional)</label>
                  <select name="mes" defaultValue={modal.doc?.mes ?? ''} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]">
                    <option value="">—</option>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              {modal.modo === 'crear' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo <span className="text-red-500">*</span></label>
                  <FileInputES name="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" requerido />
                  <p className="text-xs text-gray-500 mt-1.5">Formatos: PDF, PNG, JPG</p>
                </div>
              )}
              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setModal(null)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">{loading ? 'Guardando...' : (modal.modo === 'crear' ? 'Subir' : 'Guardar')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !loading && setDeleting(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar documento?</h2>
            <p className="text-gray-500 mb-6 text-sm">Se eliminará <span className="font-semibold text-gray-700">{deleting.titulo}</span>. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleting(null)} disabled={loading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={eliminar} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
