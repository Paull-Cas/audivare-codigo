'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  fechaCreacion: string;
  metadata?: {
    invitacion_id?: string;
    empresa_nombre?: string;
  };
}

export default function PendingInvitations() {
  const [invitations, setInvitations] = useState<Notificacion[]>([]);
  const router = useRouter();

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/notificaciones?leida=false');
      if (res.ok) {
        const data = await res.json();
        const pending = data.data.filter((n: Notificacion) => n.tipo === 'INVITACION_EMPRESA');
        setInvitations(pending);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleAction = async (action: 'aceptar' | 'rechazar', invitacionId: string) => {
    try {
      await fetch(`/api/contadores/invitaciones/${invitacionId}/${action}`, { method: 'POST' });
      fetchInvitations();
      router.refresh(); // This will reload the server component "Mis empresas"
    } catch (e) {
      console.error(e);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Invitaciones pendientes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invitations.map((inv) => (
          <div key={inv.id} className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden bg-blue-50/30">
            <div className="p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl">🏢</div>
                <div>
                  <h3 className="font-semibold text-gray-900 leading-tight">{inv.metadata?.empresa_nombre}</h3>
                  <span className="text-xs text-gray-500">{new Date(inv.fechaCreacion).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5">{inv.mensaje}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (inv.metadata?.invitacion_id) {
                      handleAction('aceptar', inv.metadata.invitacion_id);
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => {
                    if (inv.metadata?.invitacion_id) {
                      handleAction('rechazar', inv.metadata.invitacion_id);
                    }
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
