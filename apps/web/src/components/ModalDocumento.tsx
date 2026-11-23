"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon, EditIcon, DeleteIcon } from "./icons";

export default function ModalDocumento({ titulo, peligro = false, ocupado, onClose, children }: {
  titulo: string; peligro?: boolean; ocupado: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-modal-initial-focus], select, textarea")?.focus();
    return () => { dialog.close(); anterior?.focus({preventScroll: true}); };
  }, []);
  return <dialog ref={ref} aria-labelledby={tituloId} aria-busy={ocupado}
    className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
    onCancel={e => { e.preventDefault(); if (!ocupado) onClose(); }}
    onClick={e => {
      if (e.target !== e.currentTarget || ocupado) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
    }}>
    <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
      <h2 id={tituloId} className="flex items-center gap-3 text-lg font-semibold">
        <span className={`rounded-lg p-2 ${peligro ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{peligro ? <DeleteIcon/> : <EditIcon/>}</span>{titulo}
      </h2>
      <button type="button" aria-label="Cerrar ventana" disabled={ocupado} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"><CloseIcon/></button>
    </header>
    <div className="p-6">{children}</div>
  </dialog>;
}
