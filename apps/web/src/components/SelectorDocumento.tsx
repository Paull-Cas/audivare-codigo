"use client";
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { DocumentosIcon, CloseIcon } from './icons';
import { ACCEPT_DOCUMENTO, validarArchivoDocumento } from '@/lib/archivo-documento';

export default function SelectorDocumento({ archivo, onChange, onProcessing, disabled = false }: {
  archivo: File | null; onChange: (file: File | null) => void; onProcessing?: (busy: boolean) => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const secuencia = useRef(0);
  const entradas = useRef(0);
  const id = useId();
  const [error, setError] = useState('');
  const [validando, setValidando] = useState(false);
  const [url, setUrl] = useState('');
  const [falloVista, setFalloVista] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const bloqueado = disabled || validando;
  function contieneArchivos(event: DragEvent<HTMLDivElement>) {
    return Array.from(event.dataTransfer.types).includes('Files');
  }
  function soltar(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    entradas.current = 0; setArrastrando(false);
    if (bloqueado) return;
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      setError('Arrastra un solo archivo a la vez: una foto JPG/PNG o un PDF.');
      return;
    }
    void seleccionar(files[0]);
  }
  useEffect(() => {
    if (!archivo) { setUrl(''); return; }
    const objectUrl = URL.createObjectURL(archivo);
    setUrl(objectUrl); setFalloVista(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [archivo]);
  useEffect(() => () => { secuencia.current++; onProcessing?.(false); }, [onProcessing]);
  async function seleccionar(file?: File) {
    if (!file || bloqueado) return;
    const actual = ++secuencia.current;
    setError(''); setValidando(true); onProcessing?.(true); onChange(null);
    try {
      const valido = await validarArchivoDocumento(file);
      if (actual === secuencia.current) onChange(valido);
    } catch (e: unknown) {
      if (actual === secuencia.current) setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      if (actual === secuencia.current) { setValidando(false); onProcessing?.(false); }
    }
  }
  return <div className="space-y-3">
    <input ref={input} id={id} type="file" accept={ACCEPT_DOCUMENTO} disabled={disabled || validando} className="hidden" aria-label="Seleccionar foto o PDF" onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; void seleccionar(file);
    }}/>
    <div role="group" aria-label="Adjuntar documento" aria-busy={validando}
      onDragEnter={event => {
        if (!contieneArchivos(event)) return;
        event.preventDefault();
        entradas.current++;
        if (!bloqueado) setArrastrando(true);
      }}
      onDragOver={event => {
        if (!contieneArchivos(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = bloqueado ? 'none' : 'copy';
      }}
      onDragLeave={event => {
        if (!contieneArchivos(event)) return;
        event.preventDefault();
        entradas.current = Math.max(0, entradas.current - 1);
        if (!entradas.current) setArrastrando(false);
      }}
      onDrop={soltar}
      className={`space-y-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${arrastrando && !bloqueado ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50/50'} ${bloqueado ? 'opacity-60' : ''}`}>
      <p className="text-sm font-medium text-slate-700">{arrastrando && !bloqueado ? 'Suelta el archivo aquí' : 'Arrastra aquí una foto o un PDF'}</p>
      <button type="button" disabled={bloqueado} aria-describedby={`${id}-ayuda`} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"><DocumentosIcon/>{validando ? 'Comprobando archivo…' : 'Seleccionar archivo'}</button>
      <p id={`${id}-ayuda`} className="text-xs text-slate-500">Un archivo a la vez: JPG/PNG o PDF. Máximo 10 MB. Revisa la vista previa antes de guardar.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {archivo && url && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0"><p className="text-xs font-medium text-slate-500">Vista previa · aún sin guardar</p><p className="break-words text-sm text-slate-700">{archivo.name}</p></div>
        <button type="button" title="Quitar archivo seleccionado" aria-label="Quitar archivo seleccionado" disabled={disabled} onClick={() => { secuencia.current++; onChange(null); setError(''); }} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><CloseIcon/></button>
      </div>
      {archivo.type === 'application/pdf' ? <div>
        <iframe title={`Vista previa de ${archivo.name}`} src={url} sandbox="allow-same-origin" className="h-80 w-full border-0 bg-slate-50"/>
        <p className="px-3 py-2 text-xs text-slate-500">Si tu navegador no muestra el PDF, <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">abre la vista previa</a> antes de guardar.</p>
      </div> : falloVista ? <p role="alert" className="p-4 text-sm text-red-700">No se pudo mostrar esta imagen. Selecciona otra foto.</p> : (
        // URL temporal local; no requiere el optimizador remoto de Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Vista previa de ${archivo.name}`} onError={() => {setFalloVista(true); onChange(null); setError('No se pudo leer la imagen. Selecciona otra foto.');}} className="max-h-80 w-full bg-slate-50 object-contain p-2"/>
      )}
    </div>}
  </div>;
}
