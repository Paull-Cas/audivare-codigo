// Ícono de cada tipo de notificación: SVG de línea (mismo estilo que icons.tsx)
// dentro de una insignia circular con color semántico. Campana gris como fallback.

const BELL = 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

const TRAZOS: Record<string, string> = {
  // Invitaciones y vínculo con la empresa
  INVITACION_EMPRESA: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  INVITACION_ACEPTADA: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  INVITACION_RECHAZADA: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  INVITACION_CANCELADA: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  REMOVIDO_EMPRESA: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  // Observaciones
  OBSERVACION_CREADA: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  OBSERVACION_ATENDIDA: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  // Facturación y documentación
  FACTURAS_IMPORTADAS: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  DOCUMENTO_CARGADO: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  DOCUMENTACION_COMPLETADA: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  MENSAJE_DOC_EMPRESA: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  // Pagos
  PAGO_REGISTRADO: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  // Gestión de usuarios
  LIMITE_USUARIOS_REDUCIDO: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  // Suscripción del servicio
  PAGO_SUSCRIPCION_VENCIDO: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  EMPRESA_SUSPENDIDA_POR_PAGO: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  // Nueva empresa registrada, pendiente de activación (edificio)
  EMPRESA_REGISTRADA_PENDIENTE: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
};

const ESTILOS: Record<string, string> = {
  INVITACION_EMPRESA: 'bg-blue-50 text-blue-600',
  INVITACION_ACEPTADA: 'bg-green-50 text-green-600',
  INVITACION_RECHAZADA: 'bg-red-50 text-red-600',
  INVITACION_CANCELADA: 'bg-gray-100 text-gray-500',
  REMOVIDO_EMPRESA: 'bg-red-50 text-red-600',
  OBSERVACION_CREADA: 'bg-amber-50 text-amber-600',
  OBSERVACION_ATENDIDA: 'bg-green-50 text-green-600',
  FACTURAS_IMPORTADAS: 'bg-blue-50 text-blue-600',
  DOCUMENTO_CARGADO: 'bg-indigo-50 text-indigo-600',
  DOCUMENTACION_COMPLETADA: 'bg-teal-50 text-teal-600',
  MENSAJE_DOC_EMPRESA: 'bg-indigo-50 text-indigo-600',
  PAGO_REGISTRADO: 'bg-green-50 text-green-600',
  LIMITE_USUARIOS_REDUCIDO: 'bg-amber-50 text-amber-600',
  PAGO_SUSCRIPCION_VENCIDO: 'bg-amber-50 text-amber-600',
  EMPRESA_SUSPENDIDA_POR_PAGO: 'bg-red-50 text-red-600',
  EMPRESA_REGISTRADA_PENDIENTE: 'bg-blue-50 text-blue-600',
};

export default function IconoTipoNotificacion({ tipo, size = 'md' }: { tipo: string; size?: 'sm' | 'md' }) {
  const estilo = ESTILOS[tipo] ?? 'bg-gray-100 text-gray-500';
  const trazo = TRAZOS[tipo] ?? BELL;
  const insignia = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
  const icono = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';

  return (
    <span className={`${insignia} ${estilo} rounded-full flex items-center justify-center flex-shrink-0`} aria-hidden="true">
      <svg className={icono} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trazo} />
      </svg>
    </span>
  );
}
