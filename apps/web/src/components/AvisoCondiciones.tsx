"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CloseIcon } from "./icons";

export default function AvisoCondiciones({ usuarioId }: { usuarioId?: string }) {
  const [pendiente, setPendiente] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const [clave, setClave] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/legal/aceptacion", { signal: controller.signal, cache: "no-store" }).then(async res => {
      if (!res.ok) return;
      const data = await res.json();
      if (controller.signal.aborted) return;
      const key = `audivare:aviso-condiciones:${usuarioId || "sesion"}:${data.version}`;
      setClave(key);
      let oculto = false;
      try { oculto = window.localStorage.getItem(key) === "cerrado"; } catch { /* Cerrar sigue funcionando en esta sesión. */ }
      setPendiente(!data.aceptada_en && !oculto);
    }).catch(() => { /* No bloquear acceso ni simular una aceptación. */ });
    return () => controller.abort();
  }, [pathname, usuarioId]);
  function cerrar() {
    setCerrado(true); setPendiente(false);
    try { if (clave) window.localStorage.setItem(clave, "cerrado"); } catch { /* Almacenamiento del navegador no disponible. */ }
  }
  return pendiente && !cerrado ? <aside className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
    <p className="flex-1">Actualizamos los términos de uso y la política de privacidad. <Link className="font-medium text-blue-700 underline underline-offset-2" href="/condiciones">Revisar condiciones</Link>. Los periodos ya pagados se respetan.</p>
    <button type="button" aria-label="Cerrar aviso de condiciones" onClick={cerrar} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><CloseIcon className="h-4 w-4"/></button>
  </aside> : null;
}
