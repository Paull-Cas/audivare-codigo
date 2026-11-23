'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Spinner from '@/components/Spinner';
import PageHeader from '@/components/PageHeader';
import { NotificacionIcon } from '@/components/icons';
import IconoTipoNotificacion from '@/components/NotificacionIcon';

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  fechaCreacion: string;
  leida: boolean;
  metadata?: {
    empresa_id?: string;
    empresa_nombre?: string;
    fecha_vencimiento?: string;
  };
}

export default function SuperadminNotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotificaciones = async () => {
      setLoading(true);
      let url = '/api/notificaciones';
      if (filter === 'UNREAD') url += '?leida=false';
      if (filter === 'READ') url += '?leida=true';

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setNotificaciones(data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchNotificaciones();
  }, [filter]);

  const handleMarcarLeidas = async () => {
    try {
      await fetch('/api/notificaciones/leer-todas', { method: 'PATCH' });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const marcarLeida = (n: Notificacion) => {
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PATCH' }).catch(() => {});
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <PageHeader
          icon={<NotificacionIcon className="w-6 h-6" />}
          title="Notificaciones"
          subtitle="Avisos de la plataforma: mensualidades vencidas y suspensiones."
          iconColor="text-orange-500"
          actions={
            <button
              onClick={handleMarcarLeidas}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Marcar todas como leídas
            </button>
          }
        />
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        <button onClick={() => setFilter('ALL')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'ALL' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Todas</button>
        <button onClick={() => setFilter('UNREAD')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'UNREAD' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>No leídas</button>
        <button onClick={() => setFilter('READ')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'READ' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Leídas</button>
      </div>

      {loading ? (
        <Spinner label="Cargando notificaciones..." />
      ) : notificaciones.length === 0 ? (
        <div className="text-center py-10 text-gray-500 font-medium bg-white rounded-lg border border-gray-100 shadow-sm">No tienes notificaciones</div>
      ) : (
        <div className="space-y-3">
          {notificaciones.map((n) => {
            const base = `p-5 rounded-lg border shadow-sm flex items-start gap-4 ${!n.leida ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`;
            const contenido = (
              <>
                <div className="mt-1">
                  <IconoTipoNotificacion tipo={n.tipo} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 text-lg">{n.titulo}</h3>
                    <span className="text-xs text-gray-500">{new Date(n.fechaCreacion).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-600 mt-1">{n.mensaje}</p>
                  {n.metadata?.empresa_id && (
                    <span className="inline-block mt-2 text-sm font-medium text-[var(--color-primary)]">
                      Ver empresas →
                    </span>
                  )}
                </div>
              </>
            );

            // Las notificaciones de pago enlazan a la gestión de empresas
            return n.metadata?.empresa_id ? (
              <Link
                key={n.id}
                href="/superadmin/empresas"
                onClick={() => marcarLeida(n)}
                className={`${base} transition-colors hover:border-blue-300 hover:bg-blue-50/70`}
              >
                {contenido}
              </Link>
            ) : (
              <div key={n.id} className={base}>
                {contenido}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
