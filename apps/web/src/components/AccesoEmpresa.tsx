'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ContactoContador from './ContactoContador';

/** La API autoriza; esta comprobación muestra el corte también en una pantalla abierta. */
export default function AccesoEmpresa({ children, pruebaHasta, bloqueadoInicial = false }: {
  children?: React.ReactNode; pruebaHasta?: string | null; bloqueadoInicial?: boolean;
}) {
  const router = useRouter();
  const [bloqueado, setBloqueado] = useState(bloqueadoInicial);
  const [prueba, setPrueba] = useState(pruebaHasta);
  useEffect(() => {
    const controller = new AbortController();
    const comprobar = async () => {
      try {
        const res = await fetch('/api/empresa', { cache: 'no-store', signal: controller.signal });
        if (res.status === 401) { router.replace('/login'); return; }
        if (res.status === 403) { setBloqueado(true); return; }
        if (res.ok) {
          const data = await res.json();
          if (bloqueadoInicial) router.refresh();
          setBloqueado(false);
          setPrueba(data.en_prueba ? data.prueba_hasta : null);
        }
      } catch { /* Una caída de red no equivale a vencimiento. */ }
    };
    void comprobar();
    const interval = setInterval(() => void comprobar(), 60000);
    const restante = prueba ? new Date(prueba).getTime() - Date.now() : NaN;
    const timeout = Number.isFinite(restante) && restante > 0
      ? setTimeout(() => void comprobar(), Math.min(restante + 50, 2147483647)) : undefined;
    return () => { controller.abort(); clearInterval(interval); if (timeout) clearTimeout(timeout); };
  }, [prueba, router, bloqueadoInicial]);

  if (bloqueado) return <div className="max-w-md mx-auto p-8 space-y-4">
    <h1 className="text-xl font-semibold">Tu empresa no tiene acceso vigente</h1>
    <p>El periodo de acceso terminó o la empresa fue suspendida. Tus datos se conservan. Comunícate con nosotros para renovar el acceso.</p>
    <ContactoContador />
    <button type="button" onClick={() => window.location.reload()} className="underline">Comprobar acceso nuevamente</button>
  </div>;
  return <>{prueba && <div role="status" className="bg-amber-50 text-amber-900 px-6 py-3 text-sm">
    Prueba gratuita de siete días. Vence el {new Date(prueba).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (hora de Perú).
    {' '}Coordina tu pago para continuar usando AudiVare.
  </div>}{children}</>;
}
